import { atom, read, update } from 'claude-code'
import type { EngineInterface, ImageSource, Register, RenderChildren, Timer, ToolCallResult } from 'claude-code'

import type { AtlasMap, AtlasNode, AtlasStage, AtlasTab, IrisImages } from '../types'
import {
  age,
  applyPatch,
  bandLine,
  breadcrumb,
  EMPTY,
  focusLabel,
  focusNodes,
  isEmpty,
  migrate,
  RESEARCH_LIMIT,
  toMarkdown,
  type Patch,
} from './model'
import { hash, ROUTE_H, ROUTE_W, routeSvg } from './route'
import { parseWatch, watchPrompt, WATCH_SYSTEM, type Turn } from './watch'

const PANE = 'atlas'
const TOOL = 'mcp__atlas__atlas_update'

const mapAtom = atom({ plugin: 'atlas', key: 'map' } as const, EMPTY)
const changes = atom({ plugin: 'atlas', key: 'changes' } as const, 0)
const isStale = atom({ plugin: 'atlas', key: 'isStale' } as const, false)
const tab = atom({ plugin: 'atlas', key: 'tab' } as const, 'map')
const seen = atom({ plugin: 'atlas', key: 'seen' } as const, [])
const isWatching = atom({ plugin: 'atlas', key: 'isWatching' } as const, false)
const isInitDismissed = atom({ plugin: 'atlas', key: 'isInitDismissed' } as const, false)
const isKeeping = atom({ plugin: 'atlas', key: 'isKeeping' } as const, false)
// iris's state, read only: which figure the iris pane shows, and every figure's renders.
const irisSel = atom({ plugin: 'iris', key: 'sel' } as const, null)
const irisFigures = atom({ plugin: 'iris', key: 'figures' } as const, [])
// How the viewing terminal shows pictures (see IrisImages): iris's answer, or atlas's own when atlas asked first.
const irisImages = atom({ plugin: 'iris', key: 'images' } as const, 'unknown' as IrisImages)
const images = atom({ plugin: 'atlas', key: 'images' } as const, 'unknown' as IrisImages)

const RULES = `# atlas: keep the user oriented
Long sessions drift: a big plan, a couple of steps done, then one step turns into its own search space and the session never returns to the top. The user may be a visual thinker who loses track of where things stand. The atlas map (goal, plan tree, facts, glossary, pipeline stages, parked tangents, trail) is shown beside the transcript and above the prompt. Keep it true with the atlas_update tool. The user is free to go anywhere; your job is to keep the books and the way back.
- When work has a goal and more than one step, set the goal and steps.
- When a step turns into its own problem, give it sub-steps (substeps with under: "3"). Steps are addressed by paths like "3.2".
- When work leaves the step in focus, file it as a detour (with why). When a step or detour is finished, call done with a one-line outcome: atlas moves to the next step or back up to the parent. Then say where that leaves the top-level plan.
- Park tangents (park) instead of chasing them, and offer the parked list when a branch finishes.
- Record facts the user would otherwise ask about again: dataset and version, tensor shapes and dtypes, key paths, configs, checkpoints. Pin the two or three that matter most right now.
- Do not coin abbreviations or nicknames. Write the full name. If a short form is unavoidable, add it to the glossary before its first use.
- After any step that changes data or a figure, render a sample with the iris show tool, Read the PNG, and say what is visible before claiming success. Link the figure to its pipeline stage.
- Add a trail item for each result, decision or dead end, in one line.
- A watchdog also files each turn into the map automatically. If it filed something wrong, correct it.
- Write visible text (titles, labels, captions) capitalised, never all lower case.`

const MAP_SCHEMA = {
  type: 'object',
  properties: {
    goal: { type: 'string', description: 'The overall goal, one line.' },
    steps: { type: 'array', items: { type: 'string' }, description: 'Replace the top-level plan with these step titles.' },
    current: { type: 'integer', minimum: 1, description: 'Top-level step now in progress (same as focus: "n").' },
    focus: { type: 'string', description: 'Step path to put in focus, e.g. "3" or "3.2".' },
    substeps: {
      type: 'object',
      description: 'Give a step its own sub-plan; the first sub-step takes focus.',
      properties: { under: { type: 'string', description: 'Path of the parent step, e.g. "3".' }, steps: { type: 'array', items: { type: 'string' } } },
      required: ['under', 'steps'],
    },
    detour: {
      type: 'object',
      description: 'File work that left the step in focus as a detour under it, and focus the detour.',
      properties: { title: { type: 'string' }, why: { type: 'string' } },
      required: ['title'],
    },
    done: {
      type: 'object',
      description: 'Finish a step (default: the one in focus); focus moves to its next sibling or back to its parent.',
      properties: { path: { type: 'string' }, outcome: { type: 'string', description: 'One-line result.' } },
    },
    step_updates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          n: { type: 'integer', minimum: 1, description: 'Top-level step number.' },
          path: { type: 'string', description: 'Or a path such as "3.2".' },
          status: { type: 'string', enum: ['todo', 'doing', 'done', 'dropped'] },
          outcome: { type: 'string', description: 'One-line result of the step.' },
        },
      },
    },
    facts: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'Facts to set, e.g. {"Dataset": "UXTD v2", "Input shape": "(B, T, 1, 64, 128)"}. Empty string deletes.',
    },
    pin: { type: 'array', items: { type: 'string' }, description: 'Fact names to show above the prompt (replaces the list).' },
    glossary: { type: 'object', additionalProperties: { type: 'string' }, description: 'Term to meaning. Empty string deletes.' },
    stages: {
      type: 'array',
      description: 'Pipeline stages, upserted by name.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          in: { type: 'string', description: 'Input shape or type.' },
          out: { type: 'string', description: 'Output shape or type.' },
          figure: { type: 'integer', description: 'iris figure number showing a sample of this stage.' },
          sample: { type: 'string', description: 'A sample image already saved in the project, e.g. .claude/atlas/samples/crop.png.' },
          note: { type: 'string' },
        },
        required: ['name'],
      },
    },
    remove_stages: { type: 'array', items: { type: 'string' } },
    park: { type: 'array', items: { type: 'string' }, description: 'Tangents to come back to later, one line each.' },
    unpark: { type: 'array', items: { type: 'integer', minimum: 1 }, description: 'Parked items (1-based) picked up or dropped.' },
    recap: {
      type: 'object',
      properties: { where: { type: 'string' }, learned: { type: 'string' }, next: { type: 'string' } },
      required: ['where', 'learned', 'next'],
    },
    trail: {
      type: 'array',
      items: {
        type: 'object',
        properties: { kind: { type: 'string', enum: ['done', 'decision', 'deadend', 'note'] }, text: { type: 'string' } },
        required: ['kind', 'text'],
      },
    },
  },
  additionalProperties: false,
}

const MAP_DESCRIPTION =
  'Update the atlas map the user follows: goal, plan tree (sub-steps, detours, done with outcomes), facts, glossary, ' +
  'pipeline stages with iris figures, parked tangents, recap, and a trail of results, decisions and dead ends. ' +
  'Call it with no arguments to read the whole map.'

const GREEN = '#59A14F'
const ORANGE = '#F28E2B'
const BLUE = '#4E79A7'
const RED = '#E15759'
const GREY = '#8C8C8C'
const BROWN = '#9C755F'

let projectRoot = '.'
let sessionId = ''
let sessionName = ''
let fileMtime = 0
const SESSION_MAX_AGE_MS = 14 * 86_400_000
let workDir = '/tmp/atlas'
let probedAt = 0
let probedViewport = ''
const dims = new Map<string, { w: number; h: number }>()
// The last few main-thread turns, as the watchdog reads them. Rebuilt after a reload.
const turns: Turn[] = []
let pending: Turn = { prompt: '', actions: [], answer: '' }

// Each project's map lives in its own repo, so it travels with git and reads the same on any machine.
const mapFile = (root: string) => `${root}/.claude/atlas/map.json`
const mapNotes = (root: string) => `${root}/.claude/atlas/map.md`

/** The map as this session sees it: the shared plan, with this session's own position as the focus. */
function withMyFocus(map: AtlasMap): AtlasMap {
  const mine = map.sessions?.[sessionId]
  return mine ? { ...map, focus: mine.focus } : map
}

const lockDir = (root: string) => `${root}/.claude/atlas/.lock`

/** Runs scripts/maplock.py: the lock several sessions take before writing a project's map. */
async function maplock($: EngineInterface, ...args: string[]): Promise<boolean> {
  const out = await $.process.run(['python3', '-I', `${$.plugin.root}/scripts/maplock.py`, ...args], { timeoutMs: 10_000 }).catch(() => undefined)
  return out?.exitCode === 0
}

/** Writes a file in one step (a temporary file renamed over it), so another session never reads half of it. */
async function writeWhole($: EngineInterface, file: string, text: string) {
  const tmp = `${file}.tmp-${sessionId || 'atlas'}`
  await $.fs.write(tmp, text)
  if (!(await maplock($, 'put', tmp, file))) await $.fs.write(file, text)
}

async function save($: EngineInterface, map: AtlasMap) {
  const now = await $.clock.now()
  const sessions = Object.fromEntries(Object.entries(map.sessions ?? {}).filter(([, v]) => now - v.t < SESSION_MAX_AGE_MS))
  if (sessionId !== '') sessions[sessionId] = { name: sessionName || sessionId.slice(0, 8), focus: map.focus, t: now }
  map = { ...map, sessions }
  await update($, mapAtom, () => map)
  const ignore = `${projectRoot}/.claude/atlas/.gitignore`
  if (!(await $.fs.exists(ignore))) await $.fs.write(ignore, '# Written by atlas: the lock and half-written files never belong in git.\n.lock/\n*.tmp-*\nmap.unreadable-*.json\n')
  await writeWhole($, mapFile(projectRoot), `${JSON.stringify(map, null, 2)}\n`)
  fileMtime = (await $.fs.stat(mapFile(projectRoot)).catch(() => undefined))?.mtimeMs ?? fileMtime
  const notes = isEmpty(map) ? '' : toMarkdown(map, await read($, seen))
  await writeWhole($, mapNotes(projectRoot), `<!-- Written by atlas; change it with /atlas or atlas_update. -->\n# atlas map\n\n${notes}\n`)
}

/** The newest map: re-read from disk when another session wrote it since we last did. */
async function latest($: EngineInterface): Promise<AtlasMap> {
  const st = await $.fs.stat(mapFile(projectRoot)).catch(() => undefined)
  if (st && st.mtimeMs !== fileMtime) {
    try {
      const map = withMyFocus(migrate(JSON.parse(await $.fs.read(mapFile(projectRoot)))))
      fileMtime = st.mtimeMs
      await update($, mapAtom, () => map)
      return map
    } catch {
      // A half-written file: keep what we have and try again next time.
    }
  }
  return read($, mapAtom)
}

/**
 * Every change goes through here, so changes from several sessions merge instead of overwriting:
 * under the project's lock, read the file as it is now, apply the change, write it back.
 * Keep `change` quick (no copying or rendering): other sessions wait while it runs.
 */
async function mutate($: EngineInterface, change: (map: AtlasMap) => AtlasMap): Promise<AtlasMap> {
  const dir = lockDir(projectRoot)
  // Without the lock (another writer stuck for 5 s), write anyway: atlas never blocks the session.
  const isLocked = await maplock($, 'take', dir)
  try {
    fileMtime = -1
    const next = change(await latest($))
    await save($, next)
    return next
  } finally {
    if (isLocked) await maplock($, 'drop', dir)
  }
}

/** This session's display name, from its transcript (custom title or agent name). */
async function readSessionName($: EngineInterface, root: string, id: string): Promise<string> {
  const file = `${(await $.env.get('HOME')) ?? ''}/.claude/projects/${root.replace(/[^A-Za-z0-9]/g, '-')}/${id}.jsonl`
  const script = `grep -oE '"(customTitle|agentName)":"[^"]*"' "$1" 2>/dev/null | tail -1 | sed -E 's/.*":"//; s/"$//'`
  const out = await $.process.run(['sh', '-c', script, 'atlas', file], { timeoutMs: 10_000 }).catch(() => undefined)
  return out?.stdout.trim() ?? ''
}

/** A project's map: its repo file, else a map left in the old per-machine store (moved into the repo once). */
async function load($: EngineInterface, root: string): Promise<AtlasMap> {
  if (await $.fs.exists(mapFile(root))) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        fileMtime = (await $.fs.stat(mapFile(root))).mtimeMs
        return withMyFocus(migrate(JSON.parse(await $.fs.read(mapFile(root)))))
      } catch {
        await $.clock.sleep(300)
      }
    }
    // Still unreadable (a git merge conflict, say): keep a copy so starting over loses nothing.
    const copy = `${root}/.claude/atlas/map.unreadable-${await $.clock.now()}.json`
    await $.process.run(['cp', mapFile(root), copy]).catch(() => undefined)
    $.ui.toast(`atlas: map.json could not be read; kept a copy at ${copy} and started a new map.`)
    return migrate(undefined)
  }
  const legacy = await $.store.get(`map:${root}`)
  const map = migrate(legacy)
  if (!isEmpty(map)) {
    const previous = projectRoot
    projectRoot = root
    await save($, map)
    projectRoot = previous
  }
  return map
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'stage'
const sampleRel = (name: string) => `.claude/atlas/samples/${slug(name)}.png`

/** Copies each newly linked stage's iris render into the project, so the sample outlives the session. Returns stage name → sample path. */
async function copySamples($: EngineInterface, linked: readonly { name: string; figure: number }[]): Promise<Map<string, string>> {
  const copied = new Map<string, string>()
  for (const { name, figure } of linked) {
    const png = await irisPng($, figure)
    if (!png) continue
    const rel = sampleRel(name)
    const out = await $.process.run(['sh', '-c', 'mkdir -p "$(dirname "$2")" && cp "$1" "$2"', 'atlas', png, `${projectRoot}/${rel}`])
    if (out.exitCode === 0) {
      dims.delete(`${projectRoot}/${rel}`)
      copied.set(name, rel)
    }
  }
  return copied
}

/** Points the copied stages at their stored samples. */
function withSamples(map: AtlasMap, copied: ReadonlyMap<string, string>): AtlasMap {
  if (copied.size === 0) return map
  return { ...map, stages: map.stages.map(st => (copied.has(st.name) && st.figure !== undefined ? { ...st, sample: copied.get(st.name) } : st)) }
}

/** How to draw pictures for this viewer: atlas's own probe if it has one, else iris's; a new viewport asks again. */
async function imageMode($: EngineInterface, viewport: { columns: number; rows: number } | undefined): Promise<IrisImages> {
  const vp = `${viewport?.columns}x${viewport?.rows}`
  if (vp !== probedViewport) {
    probedViewport = vp
    await update($, images, () => 'unknown' as IrisImages)
  }
  const own = await read($, images)
  return own !== 'unknown' ? own : read($, irisImages)
}

/** An Image source for a PNG in the form this viewer reads. */
async function sourceOf($: EngineInterface, png: string, how: IrisImages): Promise<ImageSource> {
  return how === 'bytes' ? { png: (await $.fs.read(png, { as: 'bytes' })).base64 } : { file: png, format: 'png' }
}

/** Asks the renderer how an Image atlas drew came out (the session's environment is not its viewer's). */
async function probeImages($: EngineInterface, key: string, source: ImageSource, columns: number, rows: number) {
  const now = await $.clock.now()
  if (now - probedAt < 2000) return
  probedAt = now
  await $.clock.sleep(300)
  const r = await $.ui.blit({ requestId: PANE, key, source, columns, rows }).catch(() => ({ deny: 'failed' }))
  const deny = r.deny ?? ''
  const was = await read($, images)
  let next = was
  if (deny === '') next = 'png' in source ? 'bytes' : 'file'
  else if (/cannot read files/.test(deny)) next = 'bytes'
  else if (/draws its alt|not drawn under a terminal/.test(deny) && !/in use/.test(deny)) next = 'none'
  else if (/blit again/.test(deny)) probedAt = 0
  if (next !== was) {
    await update($, images, () => next)
    $.ui.invalidate('ui.render')
  }
}

/** The iris PNG for figure `n`'s latest version and current page. */
async function irisPng($: EngineInterface, n: number): Promise<string | undefined> {
  const fig = (await read($, irisFigures)).find(f => f.n === n)
  const version = fig?.versions[fig.versions.length - 1]
  return fig && version ? version.png[String(fig.page)] : undefined
}

async function pngDims($: EngineInterface, png: string) {
  let d = dims.get(png)
  if (d === undefined) {
    const out = await $.process.run(['magick', 'identify', '-format', '%w %h', `${png}[0]`], { timeoutMs: 10_000 })
    const [w, h] = out.stdout.trim().split(/\s+/).map(Number)
    d = { w: w || 1, h: h || 1 }
    dims.set(png, d)
  }
  return d
}

async function remember<R extends ToolCallResult>($: EngineInterface, tool: string, query: string, run: () => Promise<R>): Promise<R> {
  const map = await read($, mapAtom)
  const before = map.research.find(r => r.query === query)
  const result = await run()
  if (result.deny !== undefined || result.isError) return result
  const now = await $.clock.now()
  const entry = { t: now, tool, query, summary: (result.text ?? '').replace(/\s+/g, ' ').slice(0, 300) }
  await mutate($, m => ({ ...m, research: [...m.research.filter(r => r.query !== query), entry].slice(-RESEARCH_LIMIT) }))
  if (!before) return result
  return { ...result, context: [...(result.context ?? []), `atlas: the same lookup was made ${age(now, before.t)}: ${before.summary}`] }
}

/** The tool row's one line: what this call changed. */
function summarize(p: Patch | undefined): string {
  if (!p || Object.keys(p).length === 0) return 'Read the map'
  const out: string[] = []
  const n = (k: object | undefined) => (k ? Object.keys(k).length : 0)
  if (p.goal !== undefined) out.push('Goal set')
  if (p.steps) out.push(`${p.steps.length} steps`)
  if (p.current !== undefined) out.push(`Step ${p.current} now`)
  if (p.focus !== undefined) out.push(`Focus ${p.focus}`)
  if (p.substeps) out.push(`${p.substeps.steps.length} sub-steps under ${p.substeps.under}`)
  if (p.detour) out.push(`Detour: ${p.detour.title}`)
  if (p.done) out.push(`Done${p.done.path ? ` ${p.done.path}` : ''}`)
  if (p.step_updates?.length) out.push(`${p.step_updates.length} step updates`)
  if (n(p.facts)) out.push(`${n(p.facts)} facts`)
  if (p.pin) out.push(`${p.pin.length} pinned`)
  if (n(p.glossary)) out.push(`${n(p.glossary)} terms`)
  if (p.stages?.length) out.push(`${p.stages.length} stages`)
  if (p.park?.length) out.push(`${p.park.length} parked`)
  if (p.recap) out.push('Recap')
  if (p.trail?.length) out.push(`${p.trail.length} trail items`)
  return out.join(' · ') || 'Updated the map'
}

/** A route picture for one level of the plan, rendered once per distinct content. */
async function routePng($: EngineInterface, steps: AtlasNode[], current: number, prefix: string): Promise<string> {
  const svg = routeSvg(steps, current, prefix)
  const png = `${workDir}/route-${hash(svg)}.png`
  if (!(await $.fs.exists(png))) {
    const src = png.replace(/\.png$/, '.svg')
    await $.fs.write(src, svg)
    const out = await $.process.run(['magick', '-density', '96', src, png], { timeoutMs: 20_000 })
    if (out.exitCode !== 0) throw new Error(out.stderr)
  }
  return png
}

async function openPane($: EngineInterface) {
  await $.ui.open({ id: PANE, title: 'atlas' })
}

/** After a turn: a small model files the turn into the map and refreshes the recap. */
async function watch($: EngineInterface, model: string, recent: Turn[]) {
  const map = await read($, mapAtom)
  if (isEmpty(map) || recent.length === 0) return
  await update($, isWatching, () => true)
  try {
    const reply = await $.model.complete({ model, system: WATCH_SYSTEM, prompt: watchPrompt(map, recent), maxTokens: 900 })
    if (!reply.isAnswered) return
    const patch = parseWatch(reply.text)
    if (!patch) return
    const now = await $.clock.now()
    await mutate($, m => {
      const next = applyPatch(m, patch, now)
      if (patch.recap && next.recap) next.recap = { ...next.recap, by: model === 'haiku' ? 'Haiku' : 'Sonnet' }
      return next
    })
  } finally {
    await update($, isWatching, () => false)
  }
}

const KEEPER_PROMPT = `You are the atlas keeper. You keep the project's atlas map true in the background so the user never has to ask for upkeep. The map is shown to a user who thinks visually and loses track of long sessions.

Rules:
- Read anything in the project. Write files only inside .claude/atlas/ (sample images). Never edit project code, configs or data; never run training, long jobs, installs, or git commands that change anything.
- Finish within a few minutes of work. Do the tasks you are given and nothing else.
- Change the map only through the atlas_update tool. Use full names; capitalise the first word of every label.

Rendering a stage sample:
- Find one real example of the stage's output (the code, caches, run folders or result files tell you where). Draw it in the form that fits its shape: an image or frame, a signal trace (a few channels, a short window), a heat map for a matrix, a short table rendered as an image for scalars.
- Use a short Python script run with: uv run --quiet --with matplotlib --with numpy python -I <script>. Put the script in /tmp, not in the project.
- Save the PNG at the path given in the task, Read it, and only then call atlas_update with stages: [{name, sample: <path>, note: <one line saying what is visible>}].
- If you cannot find real data within a few tries, say so in the note and stop; never draw made-up data.

Checking facts: compare pinned facts and the newest facts with the repository (git log, result and registry files). Fix wrong ones with atlas_update facts, and add a trail note saying what changed.

Glossary: add any abbreviation, run-ID prefix or nickname from the recent turns that the glossary lacks.

End with one short line saying what you did.`

const KEEPER_EVERY_MS = 10 * 60_000
const KEEPER_CHECK_TURNS = 15
let keeperId: string | undefined
let refreshTimer: Timer | undefined
let lastKeeperAt = 0
let turnsSinceKeeper = 0

/** Upkeep the map needs now: stages without a sample, and a periodic fact and glossary check. */
async function keeperTasks($: EngineInterface, map: AtlasMap, root: string): Promise<string[]> {
  const tasks: string[] = []
  const missing = []
  // A stage needs a sample when it has none stored and its iris figure is gone (iris numbers do not outlive a session).
  for (const st of map.stages) {
    if (st.sample !== undefined && (await $.fs.exists(`${root}/${st.sample}`))) continue
    if (st.figure !== undefined && (await irisPng($, st.figure))) continue
    missing.push(st)
  }
  for (const st of missing.slice(0, 2)) {
    tasks.push(`Render a sample for the "${st.name}" stage${st.out ? ` (output ${st.out})` : ''} and save it at ${root}/${sampleRel(st.name)}.`)
  }
  if (turnsSinceKeeper >= KEEPER_CHECK_TURNS) tasks.push('Check the pinned facts against the repository, and add missing glossary entries from the recent turns.')
  return tasks
}

async function startKeeper($: EngineInterface, tasks: string[]) {
  if (tasks.length === 0 || (await read($, isKeeping))) return
  const map = await read($, mapAtom)
  const recent = turns.slice(-3).map((t, i) => `Turn ${i + 1}. User: ${t.prompt}\nActions: ${t.actions.join('; ')}\nAssistant: ${t.answer}`).join('\n\n')
  const prompt = [
    `Project root: ${projectRoot}`,
    '',
    'Tasks:',
    ...tasks.map((t, i) => `${i + 1}. ${t}`),
    '',
    'The map now:',
    toMarkdown(map, await read($, seen)),
    '',
    'Recent turns:',
    recent || '(none)',
  ].join('\n')
  await update($, isKeeping, () => true)
  lastKeeperAt = await $.clock.now()
  turnsSinceKeeper = 0
  try {
    const r = await $.agent.spawn({ subagentType: 'atlas:keeper', prompt, description: 'atlas keeper' })
    keeperId = r.agentId
    if (!keeperId) await update($, isKeeping, () => false)
  } catch {
    await update($, isKeeping, () => false)
  }
}

const HISTORIAN_PROMPT = `You are the atlas historian. You read one chunk of a project's past Claude Code conversations (the user's and Claude's words, plus one line per tool call; tool output is cut) and write down what happened, so the main session can rebuild the project's map without rereading everything.

Read the whole chunk file you are given (in parts if it is long). Do not read anything else. Do not write or change any file.

Reply with only these sections, dated where the chunk gives a time, in plain full words (no new abbreviations; explain any that the chunk uses):
- Goals: what the user was trying to achieve, and any deadlines or targets.
- Steps: the work done, in order, each with its result (numbers, scores, shapes, paths, run names exactly as written).
- Decisions: what was chosen over what, and why.
- Dead ends: what was tried and dropped, with the numbers that killed it.
- Facts: datasets and versions, input and output shapes, splits, key paths, best scores and which run produced them.
- Open threads: what was left unfinished, running, or waiting on the user at the end of the chunk.
- Terms: abbreviations, run-ID prefixes and nicknames, with their meanings.
- Conflicts: places where the conversation contradicts itself (say which came later).

Keep it under 900 words. Leave out chat, tooling trouble and anything that did not change the project.`

/** The cold-start instruction: rebuild the map from the conversation, past transcripts, memory and the repository. */
function bootstrapText(history: { chunks: { file: string; from: string; to: string }[]; memory: string[]; transcripts: number } | undefined): string {
  const past = history && history.chunks.length > 0
    ? [
        `2. Read the project's history. Its ${history.transcripts} past transcripts are digested into ${history.chunks.length} chunks, oldest first:`,
        ...history.chunks.map((c, i) => `   ${i + 1}. ${c.file} (${c.from} to ${c.to})`),
        '   Hand each chunk to its own atlas:historian agent (Agent tool, subagent_type "atlas:historian", prompt: the chunk path), several in one message so they run in parallel. Do not read the chunks yourself.',
        ...(history.memory.length > 0 ? ['   Also read the project memory notes:', ...history.memory.map(m => `   - ${m}`)] : []),
      ]
    : ['2. There are no past transcripts for this project; skip to the repository.']
  return [
    'Build the atlas map for this project now (a cold start: the project already has history).',
    '1. Start from what you already know in this conversation: the goal, what has been done, what is in progress, what was tried and dropped, and what is waiting on me.',
    ...past,
    '3. Check and fill gaps from the repository with a quick read: README or context docs, backlog or notes, recent git log and branches, run or result records, uncommitted changes. Do not read everything; aim for the shape of the project. Where history and the repository disagree, the newer source usually wins, but say so.',
    '4. Write it with atlas_update, in a few calls. If the map already has content (call atlas_update with no arguments to see it), revise it instead of starting over: keep steps, sub-steps and outcomes that are right, correct the rest, and add only trail lines, facts and glossary entries that are not there yet.',
    '   - goal (one line, with the target and deadline if there is one)',
    '   - steps: the top-level plan with done and in-progress marked (step_updates with one-line outcomes for finished steps); then focus on where the work actually is now, with substeps for the branch the work drilled into, and detours for side work that left its step',
    '   - facts: datasets and versions, input and output shapes and dtypes, splits, key paths, best scores and which run produced them, deadlines; pin the three that matter most right now',
    '   - stages: the pipeline from raw data to the final artefact, with the shape or format in and out of each stage',
    '   - glossary: every abbreviation, run-ID prefix and nickname in use, with its meaning',
    '   - trail: decisions and dead ends, one line each, oldest first',
    '   - park: open threads and tangents that are not the current focus',
    '   - recap: where we are, the most useful thing learned, the next concrete step and how it leads back to the top-level plan',
    '5. Where sources disagree and you cannot tell which is right, do not guess: add a trail note starting "Open question:" and list them for me at the end.',
    'Then show me the plan, in a few lines, as a tree.',
  ].join('\n')
}

/** Digest the project's past transcripts, then ask the main session to build the map from them. */
async function startInit($: EngineInterface) {
  const out = `${workDir}/history`
  let history
  try {
    const r = await $.process.run(['python3', '-I', `${$.plugin.root}/scripts/digest.py`, projectRoot, out], { timeoutMs: 300_000 })
    if (r.exitCode === 0) history = JSON.parse(await $.fs.read(`${out}/index.json`))
  } catch {
    // No history to read: build from the conversation and the repository alone.
  }
  await $.prompt.submit({ text: bootstrapText(history), asUser: true })
}

/** What the Look at it button sends. */
function lookText(stage: AtlasStage): string {
  const what = stage.sample ? `the sample at ${projectRoot}/${stage.sample}` : `iris figure #${stage.figure}`
  return `Look at ${what} for the "${stage.name}" stage: Read the PNG and tell me what is actually visible and whether anything looks wrong.`
}

/** The instructions the drift buttons send, as if typed. */
function returnText(map: AtlasMap): string {
  const path = focusNodes(map)
  const here = path[path.length - 1]
  const parent = path[path.length - 2]
  return `Wrap up "${here?.title ?? 'this detour'}": record what came of it with atlas_update (done, with a one-line outcome), then continue with ${parent ? `"${parent.title}"` : 'the top-level plan'} and tell me where that leaves the plan.`
}

function parkText(map: AtlasMap): string {
  const here = focusNodes(map).pop()
  return `Park "${here?.title ?? 'this tangent'}" with atlas_update (park, then done with outcome "Parked"), and return to the step it came from.`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    projectRoot = await $.session.root()
    sessionId = await $.session.id()
    sessionName = await readSessionName($, projectRoot, sessionId)
    workDir = `${(await $.env.get('TMPDIR')) ?? '/tmp'}/atlas-${sessionId}`
    const loaded = await load($, projectRoot)
    await update($, mapAtom, () => loaded)
    await $.tool.register({ name: 'atlas_update', description: MAP_DESCRIPTION, inputSchema: MAP_SCHEMA, isDeferred: false })
    await $.agent
      .register({
        name: 'keeper',
        description: 'Keeps the atlas map true in the background: renders missing stage samples, checks facts, fills the glossary.',
        prompt: KEEPER_PROMPT,
        tools: ['Read', 'Glob', 'Grep', 'Bash', TOOL],
        model: 'sonnet',
        maxTurns: 30,
        background: true,
        omitClaudeMd: true,
      })
      .catch(() => undefined)
    await $.agent
      .register({
        name: 'historian',
        description: 'Summarises one chunk of a project\'s past transcripts for /atlas init: goals, steps with results, decisions, dead ends, facts, open threads, terms.',
        prompt: HISTORIAN_PROMPT,
        tools: ['Read'],
        // Haiku kept every checked number on two cerebrov2 chunks and found more contradictions than Sonnet; the main session does the judgement.
        model: 'haiku',
        maxTurns: 12,
        omitClaudeMd: true,
      })
      .catch(() => undefined)
    await update($, isKeeping, () => false)
    // Other sessions on this project write the same map; pick their changes up within a few seconds.
    refreshTimer?.cancel()
    refreshTimer = $.clock.every(3000, () => void latest($).catch(() => undefined))
    await $.command.register({ name: 'atlas', description: 'Open the atlas map. /atlas init builds one for a project with history; /atlas reset clears it; /atlas recap runs a deep recap; /atlas project <path> switches project.', argumentHint: '[init | reset | recap | project <path>]' })

    return next(e)
  })

  // The keeper is atlas's own: the main model never delegates to it.
  on('agent.offer', { agent: 'atlas:keeper' }, () => ({ isOffered: false }))

  // ---- the model's side ----

  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    return { sections: [...result.sections, { id: 'atlas:rules', text: RULES, scope: 'session' as const }] }
  }).catch(($, e, next) => next(e))

  on('prompt.submit', async ($, e, next) => {
    const result = await next(e)
    if (result.drop !== undefined) return result
    pending = { prompt: result.text.slice(0, 700), actions: [], answer: '' }
    const map = await read($, mapAtom)
    const lines: string[] = []
    if (isEmpty(map)) {
      lines.push('atlas: no map yet for this project. When the work has a goal and steps, start one with atlas_update.')
    } else {
      const terms = Object.keys(map.glossary)
      lines.push(`atlas: ${bandLine(map, false)}${terms.length > 0 ? ` · Glossary: ${terms.join(', ')}` : ''} · atlas_update with no arguments returns the full map.`)
      if (map.recap) lines.push(`atlas recap: ${map.recap.where} Next: ${map.recap.next}`)
      if (map.drift) lines.push(`atlas: drift note on the step in focus: ${map.drift.note}`)
      const unsampled = map.stages.filter(st => st.figure === undefined && st.sample === undefined).map(st => st.name)
      if (unsampled.length > 0) {
        lines.push(`atlas: pipeline stages with no sample yet: ${unsampled.join(', ')}. When the work touches one of them, render one real example with iris and link it (stages[].figure).`)
      }
      if (await read($, isStale)) {
        lines.push(`atlas: ${await read($, changes)} edits or commands since the map was last updated. Update the steps, facts and trail if they changed.`)
      }
    }
    return { ...result, context: [...(result.context ?? []), ...lines] }
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const { tool: _t, tool_use_id: _id, ...patch } = e as unknown as Patch & { tool: string; tool_use_id: string }
    if (Object.keys(patch).length === 0) return { result: toMarkdown(await latest($), await read($, seen)) }
    const linked = (patch.stages ?? []).flatMap(st => (st.figure !== undefined ? [{ name: st.name, figure: st.figure }] : []))
    const copied = await copySamples($, linked)
    const now = await $.clock.now()
    const next = await mutate($, m => withSamples(applyPatch(m, patch, now), copied))
    await update($, changes, () => 0)
    await update($, isStale, () => false)
    return { result: `Map updated. Above the prompt: ${bandLine(next, false) || '(nothing pinned yet)'}` }
  }).catch(() => ({ deny: 'atlas failed while updating the map.' }))

  // Every main-thread call: note it for the watchdog, and count changes since the last map update.
  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined || result.deny !== undefined) return result
    const args = e as unknown as Record<string, unknown>
    const detail = [args.file_path, args.command, args.path, args.pattern, args.title, args.query, args.url].find(v => typeof v === 'string') as string | undefined
    if (pending.actions.length < 30) pending.actions.push(`${e.tool}${detail ? ` ${detail.slice(0, 90)}` : ''}`)
    if (!result.isReadOnly && (e.tool === 'Edit' || e.tool === 'Write' || e.tool === 'NotebookEdit' || e.tool === 'Bash')) {
      await update($, changes, n => n + 1)
    }
    return result
  })

  // A Read of an iris render means Claude looked at that figure.
  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    const result = await next(e)
    if (result.deny !== undefined) return result
    const m = /\/iris-[^/]+\/(\d+)\/v\d+-p\d+\.png$/.exec(e.file_path)
    const n = m ? Number(m[1]) : undefined
    if (n !== undefined) await update($, seen, list => (list.includes(n) ? list : [...list, n]))
    // Looking at a stage's render, or at its stored sample, marks that stage seen in the saved map.
    const map = await latest($)
    const now = await $.clock.now()
    let isChanged = false
    const stages = map.stages.map(st => {
      const isThis =
        (n !== undefined && st.figure === n) || e.file_path === `${projectRoot}/${st.sample ?? sampleRel(st.name)}`
      if (!isThis) return st
      isChanged = true
      return { ...st, seenAt: now }
    })
    if (isChanged) {
      const hit = new Set(stages.filter(st => st.seenAt === now).map(st => st.name))
      await mutate($, m => ({ ...m, stages: m.stages.map(st => (hit.has(st.name) ? { ...st, seenAt: now } : st)) }))
    }
    return result
  })

  // A render shown with id "stage-<name>" (or titled like a stage) becomes that stage's sample at once.
  on('tool.call', { tool: 'mcp__iris__show' }, async ($, e, next) => {
    const result = await next(e)
    if (result.deny !== undefined || result.isError) return result
    const text = typeof result.result === 'string' ? result.result : (result.text ?? '')
    const m = /as #(\d+) /.exec(text)
    const args = e as unknown as { id?: string; title?: string }
    if (!m) return result
    const map = await latest($)
    const stage = map.stages.find(
      st => args.id === `stage-${st.name}` || args.id === `stage-${slug(st.name)}` || (args.title ?? '').toLowerCase() === st.name.toLowerCase(),
    )
    if (!stage) return result
    const now = await $.clock.now()
    const figure = Number(m[1])
    const copied = await copySamples($, [{ name: stage.name, figure }])
    await mutate($, mm => withSamples(applyPatch(mm, { stages: [{ name: stage.name, figure }] }, now), copied))
    return result
  })

  // Research cache: remember lookups, and say so when one repeats.
  on('tool.call', { tool: 'WebSearch' }, ($, e, next) => remember($, e.tool, e.query, () => next(e)))
  on('tool.call', { tool: 'WebFetch' }, ($, e, next) => remember($, e.tool, `${e.url} ${e.prompt}`, () => next(e)))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined && e.agentId === keeperId) {
      keeperId = undefined
      await update($, isKeeping, () => false)
      const line = e.answer.trim().split('\n').pop()?.slice(0, 160) ?? ''
      if (line !== '') $.ui.toast(`atlas keeper: ${line}`)
      return next(e)
    }
    if (e.agentId === undefined && !e.isAborted) {
      turnsSinceKeeper += 1
      if ((await read($, changes)) > 0 && !isEmpty(await read($, mapAtom))) await update($, isStale, () => true)
      turns.push({ ...pending, answer: e.answer.slice(0, 900) })
      if (turns.length > 12) turns.shift()
      pending = { prompt: '', actions: [], answer: '' }
      void watch($, 'haiku', turns.slice(-2)).catch(() => undefined)
      const map = await read($, mapAtom)
      if (!isEmpty(map) && (await $.clock.now()) - lastKeeperAt > KEEPER_EVERY_MS) {
        void keeperTasks($, map, projectRoot).then(tasks => startKeeper($, tasks)).catch(() => undefined)
      }
    }
    return next(e)
  })

  // ---- the user's side ----

  on('command.run', { command: 'atlas' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'reset') {
      await save($, migrate(undefined))
      await update($, changes, () => 0)
      await update($, isStale, () => false)
      return { text: 'atlas: this project\'s map is cleared.' }
    }
    if (arg === 'init') {
      void startInit($)
      await openPane($)
      return { text: 'atlas: building this project\'s map from past transcripts, memory notes, the conversation and the repository.' }
    }
    if (arg.startsWith('project')) {
      const target = arg.slice('project'.length).trim()
      const root = target === '' ? await $.session.root() : target.replace(/\/+$/, '').replace(/^~(?=\/)/, (await $.env.get('HOME')) ?? '~')
      const loaded = await load($, root)
      projectRoot = root
      await update($, mapAtom, () => loaded)
      await update($, changes, () => 0)
      await update($, isStale, () => false)
      turns.length = 0
      await openPane($)
      return { text: `atlas: now showing the map for ${root}.` }
    }
    if (arg === 'recap') {
      void watch($, 'sonnet', turns.slice()).catch(() => undefined)
      await openPane($)
      return { text: 'atlas: deep recap running on Sonnet; it appears in the Recap card.' }
    }
    await openPane($)
    return { text: 'atlas pane opened.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const map = await read($, mapAtom)
    if (e.props.hasSurvey) return next(e)
    if (isEmpty(map)) {
      if (await read($, isInitDismissed)) return next(e)
      const { Box, Text, Button } = $.ui.resolve(e)
      return (
        <Box flexDirection="row" columnGap={1}>
          <Text dimColor>atlas: no map for this project yet.</Text>
          <Button key="atlas-init" label="Build map" onPress={() => void startInit($)} />
          <Button key="atlas-later" plain dimColor label="Not now" onPress={() => update($, isInitDismissed, () => true)} />
        </Box>
      )
    }
    const { Box, Text, Button } = $.ui.resolve(e)
    const sel = await read($, irisSel)
    const stale = await read($, isStale)
    const watching = await read($, isWatching)
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={1}>
          <Text wrap="truncate-end">{bandLine(map, stale, sel?.n)}</Text>
          {watching && <Text dimColor>◷</Text>}
          {(await read($, isKeeping)) && <Text dimColor>⚙ Keeper</Text>}
          <Button key="open-atlas" plain dimColor label="Map" onPress={() => openPane($)} />
        </Box>
        {map.drift && (
          <Box flexDirection="row" columnGap={1}>
            <Text color={RED} wrap="truncate-end">↯ {map.drift.note}</Text>
            <Button key="drift-return" label="Return" onPress={() => $.prompt.submit({ text: returnText(map), asUser: true })} />
            <Button
              key="drift-keep"
              label="Keep going"
              onPress={async () => {
                await mutate($, m => {
                  const nodeId = m.drift?.nodeId
                  return { ...m, drift: null, keepGoing: nodeId ? [...m.keepGoing, nodeId] : m.keepGoing }
                })
              }}
            />
            <Button key="drift-park" label="Park" onPress={() => $.prompt.submit({ text: parkText(map), asUser: true })} />
          </Box>
        )}
      </Box>
    )
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.props.tool !== TOOL) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row">
        <Text bold color={ORANGE}>atlas</Text>
        <Text dimColor> · {summarize(e.props.input as Patch)}</Text>
      </Box>
    )
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const map = await read($, mapAtom)
    const current = await read($, tab)
    const looked = await read($, seen)
    const width = Math.max(24, e.props.bodyColumns)
    const inner = width - 4

    const tabs: [AtlasTab, string, string][] = [
      ['map', 'm', 'Map'],
      ['pipeline', 'p', 'Pipeline'],
      ['glossary', 'g', 'Glossary'],
      ['trail', 't', 'Trail'],
    ]
    const header = (
      <Box flexDirection="row" columnGap={1}>
        {tabs.map(([id, key, label]) => (
          <Button key={`tab-${id}`} hotkey={key} label={label} variant={id === current ? 'primary' : 'secondary'} onPress={() => update($, tab, () => id)} />
        ))}
      </Box>
    )

    if (isEmpty(map)) {
      return (
        <Box flexDirection="column">
          {header}
          <Text dimColor>No map for this project yet. Claude starts one with atlas_update once the work has a goal and steps.</Text>
        </Box>
      )
    }

    const chip = (label: string, colour: string) => (
      <Text backgroundColor={colour} color="#FFFFFF" bold>
        {` ${label} `}
      </Text>
    )
    const card = (key: string, title: string, colour: string, children: RenderChildren) => (
      <Box key={key} flexDirection="column" borderStyle="round" borderColor={colour} paddingX={1} width={width}>
        <Text bold color={colour}>
          {title}
        </Text>
        {children}
      </Box>
    )
    const table = (rows: [string, string, boolean?][], keyPrefix: string) => {
      const kw = Math.min(24, Math.max(...rows.map(([k]) => k.length)) + 2)
      return rows.map(([k, v, isMarked]) => (
        <Box key={`${keyPrefix}-${k}`} flexDirection="row">
          <Box width={kw} flexShrink={0}>
            <Text bold>{k}</Text>
          </Box>
          <Text color={isMarked ? ORANGE : undefined}>{v}</Text>
        </Box>
      ))
    }
    const how = e.surface === 'terminal' ? await imageMode($, e.viewport) : 'none'
    const routeImage = async (key: string, steps: AtlasNode[], at: number, prefix: string) => {
      if (how === 'none' || e.surface !== 'terminal' || steps.length === 0) return null
      const png = await routePng($, steps, at, prefix).catch(() => undefined)
      if (!png) return null
      const { Image } = $.ui.resolve(e)
      const cols = Math.min(width, 255)
      const rows = Math.max(3, Math.round((cols * ROUTE_H) / ROUTE_W / 2))
      const id = `${key}-${png.slice(-14)}-${cols}x${rows}`
      const source = await sourceOf($, png, how)
      void probeImages($, id, source, cols, rows).catch(() => undefined)
      return <Image key={id} source={source} columns={cols} rows={rows} alt="Plan route" />
    }
    const now = await $.clock.now()

    let body
    if (current === 'map') {
      const path = focusNodes(map)
      const here = path[path.length - 1]
      const top = path[0]
      const topRoute = await routeImage('route-top', map.plan, top ? map.plan.indexOf(top) : -1, '')
      let branchRoute = null
      if (path.length >= 2) {
        const parent = path[path.length - 2]
        const siblings = parent?.children ?? []
        const label = focusLabel(map).split('.').slice(0, -1).join('.')
        branchRoute = (
          <Box flexDirection="column">
            <Text dimColor>Inside {label} {parent?.title}</Text>
            {await routeImage('route-branch', siblings, here ? siblings.indexOf(here) : -1, `${label}.`)}
          </Box>
        )
      }
      const pinned = map.pinned.filter(k => map.facts[k]).map(k => [k, map.facts[k]?.value ?? ''] as [string, string])
      const others = Object.entries(map.facts)
        .filter(([k]) => !map.pinned.includes(k))
        .map(([k, f]) => {
          const isRecent = f.was !== undefined && now - f.changedAt < 10 * 60_000
          return [k, isRecent ? `${f.value}  (was ${f.was})` : f.value, isRecent] as [string, string, boolean]
        })
      const treeRows: RenderChildren[] = []
      const walk = (nodes: AtlasNode[], prefix: string, depth: number) => {
        nodes.forEach((n, i) => {
          const p = prefix === '' ? String(i + 1) : `${prefix}.${i + 1}`
          const isHere = n === here
          treeRows.push(
            <Box key={`node-${n.id}`} flexDirection="row" columnGap={1}>
              <Box flexGrow={1}>
                <Text bold={isHere} dimColor={n.status === 'todo' || n.status === 'dropped'} color={isHere ? ORANGE : undefined}>
                  {'  '.repeat(depth)}
                  {n.kind === 'detour' ? '↪ ' : ''}
                  {p}. {n.title}
                  {n.outcome ? <Text dimColor> · {n.outcome}</Text> : ''}
                </Text>
              </Box>
              {n.status === 'done' && chip('Done', GREEN)}
              {isHere && chip('Now', ORANGE)}
              {n.status === 'doing' && !isHere && chip('Open', BLUE)}
              {n.status === 'dropped' && chip('Dropped', GREY)}
            </Box>,
          )
          // Finished branches fold away; open ones stay expanded.
          if (n.status !== 'done' || path.includes(n)) walk(n.children, p, depth + 1)
        })
      }
      walk(map.plan, '', 0)
      const recap = map.recap
      // Other sessions working on this project, and where each one is in the shared plan.
      const otherSessions = Object.entries(map.sessions ?? {})
        .filter(([id]) => id !== sessionId)
        .sort((x, y) => y[1].t - x[1].t)
      body = (
        <Box flexDirection="column">
          {map.goal !== '' && <Text bold>{map.goal}</Text>}
          {topRoute}
          {branchRoute}
          {map.drift &&
            card(
              'drift',
              '↯ Drifting?',
              RED,
              <Box flexDirection="column">
                <Text>{map.drift.note}</Text>
                <Box flexDirection="row" columnGap={1}>
                  <Button key="pane-return" label="Return" onPress={() => $.prompt.submit({ text: returnText(map), asUser: true })} />
                  <Button
                    key="pane-keep"
                    label="Keep going"
                    onPress={async () => {
                      await mutate($, m => {
                        const nodeId = m.drift?.nodeId
                        return { ...m, drift: null, keepGoing: nodeId ? [...m.keepGoing, nodeId] : m.keepGoing }
                      })
                    }}
                  />
                  <Button key="pane-park" label="Park" onPress={() => $.prompt.submit({ text: parkText(map), asUser: true })} />
                </Box>
              </Box>,
            )}
          {here &&
            card(
              'now',
              `Now · ${breadcrumb(map)}`,
              ORANGE,
              <Box flexDirection="column">
                <Text bold>{here.title}</Text>
                {here.why && <Text dimColor>Why: {here.why}</Text>}
              </Box>,
            )}
          {otherSessions.length > 0 &&
            card(
              'sessions',
              `Sessions (${otherSessions.length + 1})`,
              GREY,
              otherSessions.map(([id, ss]) => (
                <Text key={`session-${id}`}>
                  <Text bold>{ss.name}</Text> · {breadcrumb({ ...map, focus: ss.focus }) || 'No step'} <Text dimColor>· {age(now, ss.t)}</Text>
                </Text>
              )),
            )}
          {recap &&
            card(
              'recap',
              'Recap',
              BLUE,
              <Box flexDirection="column">
                <Text>
                  <Text bold>Where we are </Text>
                  {recap.where}
                </Text>
                <Text>
                  <Text bold>Learned </Text>
                  {recap.learned}
                </Text>
                <Text>
                  <Text bold color={ORANGE}>Next </Text>
                  {recap.next}
                </Text>
                <Box flexDirection="row" columnGap={1}>
                  <Text dimColor>
                    {recap.by}, {age(now, recap.t)}
                  </Text>
                  <Button key="deep-recap" plain dimColor label="Deep recap" onPress={() => void watch($, 'sonnet', turns.slice()).catch(() => undefined)} />
                </Box>
              </Box>,
            )}
          {map.plan.length > 0 && card('plan', 'Plan', BLUE, treeRows)}
          {map.parked.length > 0 &&
            card(
              'parked',
              `Parked (${map.parked.length})`,
              BROWN,
              map.parked.map((p, i) => (
                <Text key={`parked-${i}`}>
                  {i + 1}. {p.text} <Text dimColor>· from {p.from}, {age(now, p.t)}</Text>
                </Text>
              )),
            )}
          {pinned.length > 0 && card('pinned', 'Pinned', ORANGE, table(pinned, 'pin'))}
          {others.length > 0 && card('facts', 'Facts', GREY, table(others, 'fact'))}
        </Box>
      )
    } else if (current === 'pipeline') {
      const cards = []
      for (const [i, s] of map.stages.entries()) {
        const hasSample = s.figure !== undefined || s.sample !== undefined
        const isSeen = s.seenAt !== undefined || (s.figure !== undefined && looked.includes(s.figure))
        const colour = !hasSample ? GREY : isSeen ? GREEN : ORANGE
        let thumb = null
        if (how === 'none' && hasSample && e.surface === 'terminal') {
          thumb = <Text dimColor>This terminal shows no pictures; Look at it describes the sample, or open {s.sample ?? `figure #${s.figure}`}.</Text>
        } else if (hasSample && e.surface === 'terminal') {
          const stored = s.sample ? `${projectRoot}/${s.sample}` : undefined
          const png = stored && (await $.fs.exists(stored)) ? stored : s.figure !== undefined ? await irisPng($, s.figure) : undefined
          const d = png ? await pngDims($, png).catch(() => undefined) : undefined
          if (png && d) {
            const { Image } = $.ui.resolve(e)
            let cols = Math.min(inner, 255)
            let rows = Math.max(1, Math.round((cols * d.h) / d.w / 2))
            if (rows > 14) {
              rows = 14
              cols = Math.max(1, Math.round((rows * 2 * d.w) / d.h))
            }
            const id = `thumb-${i}-${cols}x${rows}`
            const source = await sourceOf($, png, how)
            void probeImages($, id, source, cols, rows).catch(() => undefined)
            thumb = <Image key={id} source={source} columns={cols} rows={rows} alt={`${s.name} sample`} />
          }
        }
        if (i > 0) cards.push(<Text key={`arrow-${i}`} color={GREY}>{'  ↓'}</Text>)
        cards.push(
          card(
            `stage-${i}`,
            `${i + 1}. ${s.name}`,
            colour,
            <Box flexDirection="column">
              <Box flexDirection="row" columnGap={1}>
                {!hasSample ? chip('No sample', GREY) : isSeen ? chip('Seen ✓', GREEN) : chip('Not looked at', ORANGE)}
                {s.sample !== undefined ? <Text dimColor>{s.sample}</Text> : s.figure !== undefined && <Text dimColor>Figure #{s.figure}</Text>}
              </Box>
              {(s.in || s.out) && (
                <Text>
                  <Text dimColor>In </Text>
                  {s.in ?? '?'}
                  <Text dimColor>  →  Out </Text>
                  {s.out ?? '?'}
                </Text>
              )}
              {s.note && <Text dimColor>{s.note}</Text>}
              {!hasSample && (
                <Button
                  key={`sample-${i}`}
                  label="Generate sample"
                  onPress={() => startKeeper($, [`Render a sample for the "${s.name}" stage${s.out ? ` (output ${s.out})` : ''} and save it at ${projectRoot}/${sampleRel(s.name)}.`])}
                />
              )}
              {hasSample && !isSeen && (
                <Button key={`look-${i}`} label="Look at it" onPress={() => $.prompt.submit({ text: lookText(s), asUser: true })} />
              )}
              {thumb}
            </Box>,
          ),
        )
      }
      body = cards.length > 0 ? <Box flexDirection="column">{cards}</Box> : <Text dimColor>No pipeline stages yet.</Text>
    } else if (current === 'glossary') {
      const terms = Object.entries(map.glossary).sort(([a], [b]) => a.localeCompare(b))
      body = terms.length > 0 ? card('glossary', 'Glossary', BLUE, table(terms, 'term')) : <Text dimColor>No terms yet.</Text>
    } else {
      const kinds: Record<string, [string, string]> = {
        decision: ['Decision', BLUE],
        deadend: ['Dead end', RED],
        done: ['Done', GREEN],
        note: ['Note', GREY],
        checkpoint: ['Checkpoint', BROWN],
      }
      const items = [...map.trail].reverse().slice(0, 60)
      const research = [...map.research].reverse().slice(0, 20)
      body = (
        <Box flexDirection="column">
          {items.length === 0 ? (
            <Text dimColor>No trail yet.</Text>
          ) : (
            card(
              'trail',
              'Trail',
              BLUE,
              items.map((t, i) => {
                const [label, colour] = kinds[t.kind] ?? ['Note', GREY]
                return (
                  <Box key={`trail-${i}`} flexDirection="row" columnGap={1}>
                    <Box width={13} flexShrink={0}>{chip(label, colour)}</Box>
                    <Box flexGrow={1}>
                      <Text>{t.text}</Text>
                    </Box>
                    <Text dimColor>{age(now, t.t)}</Text>
                  </Box>
                )
              }),
            )
          )}
          {research.length > 0 &&
            card(
              'lookups',
              'Lookups',
              GREY,
              research.map((r, i) => (
                <Text key={`research-${i}`} dimColor>
                  {r.tool === 'WebSearch' ? 'Searched' : 'Fetched'}: {r.query.slice(0, inner - 16)} ({age(now, r.t)})
                </Text>
              )),
            )}
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        {header}
        {body}
      </Box>
    )
  })
}

