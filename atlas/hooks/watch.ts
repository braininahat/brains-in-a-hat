// The watchdog: after each turn a small model files the turn into the plan tree and refreshes the recap.

import type { AtlasMap } from '../types'
import { breadcrumb, treeText, type Patch } from './model'

export type Turn = { prompt: string; actions: string[]; answer: string }

export const WATCH_SYSTEM = `You keep a work map for a user who thinks visually and loses track of long sessions. Work often drills from a big plan into one step that becomes its own search space and never returns to the top. Your job is bookkeeping, not judgement: the user may go anywhere. File the latest turns into the plan tree so the way back stays clear, and write a short recap.

Reply with one JSON object and nothing else. Every field is optional; leave out anything that did not change.
{
  "focus": "3.2",                                   // the path of the step the latest work belongs to, if it moved
  "substeps": {"under": "3", "steps": ["...", "..."]}, // only when a step clearly split into a sub-plan that the map lacks
  "detour": {"title": "...", "why": "..."},         // when the work left the step in focus for something not in the plan
  "done": {"path": "3.2", "outcome": "..."},        // when a step or detour clearly finished
  "park": ["..."],                                  // tangents mentioned but deliberately not pursued
  "recap": {"where": "...", "learned": "...", "next": "..."},
  "drift": {"note": "..."} or null,                 // a note only when two or more turns went far from the focus step with no sign it was intended; null clears an old note
  "trail": [{"kind": "decision" | "deadend" | "done" | "checkpoint", "text": "..."}]
}

Rules:
- The assistant may already have updated the map during the turn; the map below is current. Do not repeat what it already says.
- Prefer fewer structural changes. Never invent steps the work does not show. Never mark something done without evidence.
- Recap: "where" names the step in focus and what state it is in; "learned" is the one most useful finding; "next" is the next concrete action and, if a branch is nearly done, how it returns to the top-level plan. Each under 25 words.
- Full names, no abbreviations you invented. Capitalise the first word.`

/** The prompt: the map as a tree with paths, then the latest turns. */
export function watchPrompt(map: AtlasMap, turns: readonly Turn[]): string {
  const parts = [
    `Goal: ${map.goal || '(none)'}`,
    `Focus: ${breadcrumb(map) || '(none)'}`,
    '',
    'Plan:',
    treeText(map) || '(empty)',
  ]
  if (map.parked.length > 0) parts.push('', 'Parked:', ...map.parked.map((p, i) => `${i + 1}. ${p.text}`))
  if (map.recap) parts.push('', `Previous recap: where ${map.recap.where} | learned ${map.recap.learned} | next ${map.recap.next}`)
  if (map.drift) parts.push('', `Open drift note: ${map.drift.note}`)
  parts.push('', 'Latest turns, oldest first:')
  turns.forEach((t, i) => {
    parts.push(
      `--- Turn ${i + 1}`,
      `User: ${t.prompt || '(no new message; a continuation)'}`,
      `Actions: ${t.actions.length > 0 ? t.actions.join('; ') : '(none)'}`,
      `Assistant said: ${t.answer || '(nothing)'}`,
    )
  })
  return parts.join('\n')
}

const KINDS = new Set(['decision', 'deadend', 'done', 'checkpoint', 'note'])
const str = (v: unknown, max = 200): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, max) : undefined)
const isPath = (v: unknown): v is string => typeof v === 'string' && /^\d+(\.\d+)*$/.test(v)

/** Reads the model's JSON reply into a patch, keeping only well-formed fields. */
export function parseWatch(text: string): Patch | undefined {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return undefined
  }
  const patch: Patch = {}
  if (isPath(raw.focus)) patch.focus = raw.focus
  const sub = raw.substeps as { under?: unknown; steps?: unknown } | undefined
  if (sub && isPath(sub.under) && Array.isArray(sub.steps)) {
    const steps = sub.steps.map(s => str(s, 120)).filter((s): s is string => s !== undefined)
    if (steps.length > 0) patch.substeps = { under: sub.under, steps }
  }
  const det = raw.detour as { title?: unknown; why?: unknown } | undefined
  const title = str(det?.title, 120)
  if (title) patch.detour = { title, why: str(det?.why) }
  const done = raw.done as { path?: unknown; outcome?: unknown } | undefined
  if (done && (done.path === undefined || isPath(done.path))) patch.done = { path: done.path as string | undefined, outcome: str(done.outcome) }
  if (Array.isArray(raw.park)) {
    const park = raw.park.map(p => str(p, 160)).filter((p): p is string => p !== undefined)
    if (park.length > 0) patch.park = park
  }
  const rc = raw.recap as { where?: unknown; learned?: unknown; next?: unknown } | undefined
  const where = str(rc?.where)
  const learned = str(rc?.learned)
  const nxt = str(rc?.next)
  if (where && learned && nxt) patch.recap = { where, learned, next: nxt }
  if (raw.drift === null) patch.drift = null
  else {
    const note = str((raw.drift as { note?: unknown } | undefined)?.note)
    if (note) patch.drift = { note }
  }
  if (Array.isArray(raw.trail)) {
    const trail = raw.trail
      .map(t => t as { kind?: unknown; text?: unknown })
      .filter(t => typeof t.kind === 'string' && KINDS.has(t.kind) && str(t.text))
      .map(t => ({ kind: t.kind as 'decision' | 'deadend' | 'done' | 'checkpoint' | 'note', text: str(t.text) as string }))
    if (trail.length > 0) patch.trail = trail.slice(0, 4)
  }
  return Object.keys(patch).length > 0 ? patch : undefined
}
