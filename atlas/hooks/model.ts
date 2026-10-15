// The map's pure logic: the plan tree and its focus, patches, the band line, and text views.

import type { AtlasMap, AtlasNode, AtlasStage, AtlasStepStatus, AtlasTrailKind } from '../types'

export const EMPTY: AtlasMap = {
  goal: '',
  plan: [],
  focus: [],
  nextId: 1,
  facts: {},
  pinned: [],
  glossary: {},
  stages: [],
  trail: [],
  research: [],
  parked: [],
  recap: null,
  drift: null,
  keepGoing: [],
}

export const TRAIL_LIMIT = 300
export const RESEARCH_LIMIT = 100

export type Patch = {
  goal?: string
  /** Replaces the top-level plan; the first step takes focus. */
  steps?: string[]
  /** 1-based top-level step now in progress (shorthand for focus: "n"). */
  current?: number
  /** Step path such as "3" or "3.2" to put in focus. */
  focus?: string
  /** Replaces the sub-steps of the step at `under` (a path); the first takes focus. */
  substeps?: { under: string; steps: string[] }
  /** Files a detour under the step in focus and focuses it. */
  detour?: { title: string; why?: string }
  /** Marks a step done (default: the one in focus) and moves on to its next sibling or back to its parent. */
  done?: { path?: string; outcome?: string }
  /** Updates by path ("3.2") or top-level number. */
  step_updates?: { n?: number; path?: string; status?: AtlasStepStatus; outcome?: string }[]
  facts?: Record<string, string>
  pin?: string[]
  glossary?: Record<string, string>
  stages?: AtlasStage[]
  remove_stages?: string[]
  trail?: { kind: AtlasTrailKind; text: string }[]
  /** Tangents to come back to later. */
  park?: string[]
  /** 1-based parked items to remove (picked up or dropped). */
  unpark?: number[]
  recap?: { where: string; learned: string; next: string }
  /** A drift note for the step in focus; null clears it. */
  drift?: { note: string } | null
}

// ---------- tree helpers ----------

export function clone(map: AtlasMap): AtlasMap {
  return JSON.parse(JSON.stringify(map)) as AtlasMap
}

/** Nodes from the top level down to the node at `path` ("3.2" -> [step 3, its step 2]). */
export function nodesAtPath(plan: AtlasNode[], path: string): AtlasNode[] | undefined {
  const parts = path.split('.').map(p => Number(p) - 1)
  const out: AtlasNode[] = []
  let level = plan
  for (const i of parts) {
    const node = level[i]
    if (!node || !Number.isInteger(i)) return undefined
    out.push(node)
    level = node.children
  }
  return out.length > 0 ? out : undefined
}

/** Nodes along the focus path; stops at the first id that no longer exists. */
export function focusNodes(map: AtlasMap): AtlasNode[] {
  const out: AtlasNode[] = []
  let level = map.plan
  for (const id of map.focus) {
    const node = level.find(n => n.id === id)
    if (!node) break
    out.push(node)
    level = node.children
  }
  return out
}

/** "3.2"-style label of the focus path. */
export function focusLabel(map: AtlasMap): string {
  const labels: number[] = []
  let level = map.plan
  for (const id of map.focus) {
    const i = level.findIndex(n => n.id === id)
    if (i < 0) break
    labels.push(i + 1)
    level = level[i]?.children ?? []
  }
  return labels.join('.')
}

/** The siblings list that holds the last focus node, and its index there. */
function focusSlot(map: AtlasMap): { siblings: AtlasNode[]; index: number } | undefined {
  let level = map.plan
  let slot: { siblings: AtlasNode[]; index: number } | undefined
  for (const id of map.focus) {
    const i = level.findIndex(n => n.id === id)
    if (i < 0) break
    slot = { siblings: level, index: i }
    level = level[i]?.children ?? []
  }
  return slot
}

function newNode(map: AtlasMap, title: string, extra: Partial<AtlasNode> = {}): AtlasNode {
  return { id: `s${map.nextId++}`, title: title.trim(), status: 'todo', children: [], ...extra }
}

function setFocusPath(map: AtlasMap, nodes: AtlasNode[]) {
  map.focus = nodes.map(n => n.id)
  for (const n of nodes) if (n.status === 'todo') n.status = 'doing'
}

export function isEmpty(map: AtlasMap): boolean {
  return map.goal === '' && map.plan.length === 0 && Object.keys(map.facts).length === 0 && map.stages.length === 0
}

/** Accepts maps saved before the plan became a tree (flat steps + current). */
export function migrate(raw: unknown): AtlasMap {
  const m = { ...clone(EMPTY), ...((raw ?? {}) as Partial<AtlasMap>) } as AtlasMap & {
    steps?: { title: string; status: AtlasStepStatus; outcome?: string }[]
    current?: number
  }
  if (m.steps && (!m.plan || m.plan.length === 0)) {
    m.plan = m.steps.map(s => newNode(m, s.title, { status: s.status, outcome: s.outcome }))
    const cur = m.plan[m.current ?? -1]
    m.focus = cur ? [cur.id] : []
  }
  delete m.steps
  delete m.current
  return m
}

// ---------- patches ----------

export function applyPatch(map: AtlasMap, patch: Patch, now: number): AtlasMap {
  const next = clone(map)
  const trail = (kind: AtlasTrailKind, text: string) => next.trail.push({ t: now, kind, text })

  if (patch.goal !== undefined) next.goal = patch.goal.trim()
  if (patch.steps !== undefined) {
    next.plan = patch.steps.map(t => newNode(next, t))
    next.focus = []
    if (next.plan[0]) setFocusPath(next, [next.plan[0]])
  }
  if (patch.current !== undefined) patch = { ...patch, focus: String(patch.current) }
  if (patch.substeps !== undefined) {
    const nodes = nodesAtPath(next.plan, patch.substeps.under)
    const parent = nodes?.[nodes.length - 1]
    if (nodes && parent) {
      parent.children = patch.substeps.steps.map(t => newNode(next, t))
      const first = parent.children[0]
      if (first) setFocusPath(next, [...nodes, first])
    }
  }
  if (patch.focus !== undefined) {
    const nodes = nodesAtPath(next.plan, patch.focus)
    if (nodes) {
      // Moving along one level finishes the step left behind, as moving to the next station does.
      const before = focusNodes(next)
      const left = before[nodes.length - 1]
      const target = nodes[nodes.length - 1]
      if (left && target && left !== target && left.status === 'doing' && before.length >= nodes.length) {
        const siblings = nodes.length === 1 ? next.plan : nodes[nodes.length - 2]?.children ?? []
        if (siblings.indexOf(left) < siblings.indexOf(target)) left.status = 'done'
      }
      setFocusPath(next, nodes)
    }
  }
  if (patch.detour !== undefined) {
    const path = focusNodes(next)
    const parent = path[path.length - 1]
    const node = newNode(next, patch.detour.title, { kind: 'detour', why: patch.detour.why })
    if (parent) parent.children.push(node)
    else next.plan.push(node)
    setFocusPath(next, [...path, node])
    trail('note', `Detour${parent ? ` from "${parent.title}"` : ''}: ${node.title}${node.why ? ` (${node.why})` : ''}`)
  }
  if (patch.done !== undefined) {
    const nodes = patch.done.path ? nodesAtPath(next.plan, patch.done.path) : focusNodes(next)
    const node = nodes?.[nodes.length - 1]
    if (nodes && node) {
      node.status = 'done'
      if (patch.done.outcome !== undefined) node.outcome = patch.done.outcome
      trail('done', `${node.title}${node.outcome ? `: ${node.outcome}` : ''}`)
      const focus = focusNodes(next)
      if (focus.includes(node)) {
        const parents = nodes.slice(0, -1)
        const siblings = parents.length > 0 ? parents[parents.length - 1]?.children ?? [] : next.plan
        const after = siblings.slice(siblings.indexOf(node) + 1).find(s => s.status === 'todo' || s.status === 'doing')
        if (after) setFocusPath(next, [...parents, after])
        else next.focus = parents.map(p => p.id)
      }
      if (next.drift && next.drift.nodeId === node.id) next.drift = null
    }
  }
  for (const u of patch.step_updates ?? []) {
    const nodes = u.path ? nodesAtPath(next.plan, u.path) : u.n !== undefined ? nodesAtPath(next.plan, String(u.n)) : undefined
    const node = nodes?.[nodes.length - 1]
    if (!node) continue
    if (u.status !== undefined) node.status = u.status
    if (u.outcome !== undefined) node.outcome = u.outcome
  }
  for (const [key, value] of Object.entries(patch.facts ?? {})) {
    if (value === '') {
      delete next.facts[key]
      continue
    }
    const old = next.facts[key]
    if (old?.value === value) continue
    next.facts[key] = { value, changedAt: now, was: old?.value }
  }
  if (patch.pin !== undefined) next.pinned = patch.pin
  next.pinned = next.pinned.filter(k => k in next.facts)
  for (const [term, meaning] of Object.entries(patch.glossary ?? {})) {
    if (meaning === '') delete next.glossary[term]
    else next.glossary[term] = meaning
  }
  for (const stage of patch.stages ?? []) {
    if (stage.name === '') continue
    const at = next.stages.findIndex(s => s.name === stage.name)
    if (at < 0) next.stages.push({ ...stage })
    else next.stages[at] = { ...next.stages[at], ...stage }
  }
  if (patch.remove_stages) next.stages = next.stages.filter(s => !patch.remove_stages?.includes(s.name))
  for (const item of patch.trail ?? []) trail(item.kind, item.text)
  const from = focusNodes(next).map(n => n.title).pop() ?? 'the plan'
  for (const text of patch.park ?? []) next.parked.push({ t: now, text, from })
  if (patch.unpark) next.parked = next.parked.filter((_, i) => !patch.unpark?.includes(i + 1))
  if (patch.recap) next.recap = { t: now, by: 'claude', ...patch.recap }
  if (patch.drift !== undefined) {
    const at = focusNodes(next).pop()
    if (patch.drift === null || !at) next.drift = null
    else if (!next.keepGoing.includes(at.id)) {
      next.drift = { since: next.drift?.nodeId === at.id ? next.drift.since : now, note: patch.drift.note, nodeId: at.id }
    }
  }
  next.trail = next.trail.slice(-TRAIL_LIMIT)
  return next
}

// ---------- views ----------

export const STATUS_MARK: Record<AtlasStepStatus, string> = { done: '✓', doing: '▶', todo: '·', dropped: '✗' }
export const TRAIL_MARK: Record<AtlasTrailKind, string> = { done: '✓', decision: '◆', deadend: '✗', note: '·', checkpoint: '◷' }

/** A step's short name: the text before a colon, else the first three words. */
export function shortName(title: string): string {
  const head = title.includes(':') ? title.slice(0, title.indexOf(':')) : title.split(/\s+/).slice(0, 3).join(' ')
  return head.trim()
}

/** "Build tools › 3 atlas › 3.2 Route picture" */
export function breadcrumb(map: AtlasMap): string {
  const parts: string[] = []
  let level = map.plan
  const nums: number[] = []
  for (const id of map.focus) {
    const i = level.findIndex(n => n.id === id)
    const node = level[i]
    if (!node) break
    nums.push(i + 1)
    parts.push(`${nums.join('.')} ${shortName(node.title)}`)
    level = node.children
  }
  return parts.join(' › ')
}

/** The one line above the prompt. */
export function bandLine(map: AtlasMap, isStale: boolean, lastFigure?: number): string {
  const parts: string[] = []
  const crumb = breadcrumb(map)
  if (crumb !== '') parts.push(`▶ ${crumb}`)
  else if (map.goal !== '') parts.push(map.goal)
  for (const key of map.pinned) {
    const fact = map.facts[key]
    if (fact) parts.push(`${key}: ${fact.value}`)
  }
  if (lastFigure !== undefined) parts.push(`Figure #${lastFigure}`)
  if (map.parked.length > 0) parts.push(`${map.parked.length} parked`)
  if (isStale) parts.push('⚠ Map may be stale')
  return parts.join('  ·  ')
}

/** The plan tree as indented text with paths, the focus marked. */
export function treeText(map: AtlasMap): string {
  const focus = new Set(map.focus)
  const lines: string[] = []
  const walk = (nodes: AtlasNode[], prefix: string, depth: number) => {
    nodes.forEach((n, i) => {
      const path = prefix === '' ? String(i + 1) : `${prefix}.${i + 1}`
      const tag = n.kind === 'detour' ? ' [detour]' : ''
      const here = focus.has(n.id) && map.focus[map.focus.length - 1] === n.id ? '   ← focus' : ''
      lines.push(`${'  '.repeat(depth)}${path} [${n.status}]${tag} ${n.title}${n.outcome ? ` — ${n.outcome}` : ''}${here}`)
      walk(n.children, path, depth + 1)
    })
  }
  walk(map.plan, '', 0)
  return lines.join('\n')
}

/** The whole map as markdown, for the model. */
export function toMarkdown(map: AtlasMap, seen: readonly number[]): string {
  if (isEmpty(map)) return 'The atlas map for this project is empty.'
  const out: string[] = []
  if (map.goal !== '') out.push(`Goal: ${map.goal}`)
  if (map.plan.length > 0) out.push('', 'Plan (paths like 3.2 address steps):', treeText(map))
  if (map.recap) out.push('', `Recap: where ${map.recap.where}; learned ${map.recap.learned}; next ${map.recap.next}`)
  if (map.drift) out.push('', `Drift note: ${map.drift.note}`)
  if (map.parked.length > 0) {
    out.push('', 'Parked:')
    map.parked.forEach((p, i) => out.push(`${i + 1}. ${p.text} (from ${p.from})`))
  }
  const facts = Object.entries(map.facts)
  if (facts.length > 0) {
    out.push('', 'Facts:')
    for (const [k, f] of facts) out.push(`- ${k}: ${f.value}${f.was !== undefined ? ` (was ${f.was})` : ''}`)
  }
  if (map.stages.length > 0) {
    out.push('', 'Pipeline stages:')
    for (const s of map.stages) {
      const shape = s.in || s.out ? ` ${s.in ?? '?'} → ${s.out ?? '?'}` : ''
      const look = s.figure === undefined ? 'no sample shown' : seen.includes(s.figure) ? `seen (figure #${s.figure})` : `figure #${s.figure}, not looked at yet`
      out.push(`- ${s.name}:${shape} [${look}]${s.note ? ` ${s.note}` : ''}`)
    }
  }
  const terms = Object.entries(map.glossary)
  if (terms.length > 0) {
    out.push('', 'Glossary:')
    for (const [k, v] of terms) out.push(`- ${k}: ${v}`)
  }
  if (map.trail.length > 0) {
    out.push('', 'Recent trail:')
    for (const item of map.trail.slice(-10)) out.push(`${TRAIL_MARK[item.kind]} ${item.text}`)
  }
  return out.join('\n')
}

/** "3m ago" style ages for the pane. */
export function age(now: number, t: number): string {
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}
