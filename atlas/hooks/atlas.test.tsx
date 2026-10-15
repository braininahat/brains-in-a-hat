import { expect, test } from 'claude-code/testing'

import { applyPatch, bandLine, breadcrumb, EMPTY, focusLabel, focusNodes, isEmpty, migrate, toMarkdown } from './model'
import { parseWatch } from './watch'

const T0 = 1_000_000
const statuses = (nodes: { status: string }[]) => nodes.map(n => n.status)

test('a plan starts with step 1 in focus, and moving on finishes the step left behind', async () => {
  let map = applyPatch(EMPTY, { goal: 'Preprocess UXTD', steps: ['Load', 'Crop fan', 'Normalize'] }, T0)
  expect(focusLabel(map)).toBe('1')
  map = applyPatch(map, { focus: '2' }, T0)
  expect(statuses(map.plan)).toEqual(['done', 'doing', 'todo'])
  expect(breadcrumb(map)).toBe('2 Crop fan')
})

test('a step can grow sub-steps, a detour, and finishing returns up the tree', async () => {
  let map = applyPatch(EMPTY, { steps: ['iris', 'Themes', 'atlas: context map', 'Public repo'] }, T0)
  map = applyPatch(map, { focus: '3' }, T0)
  map = applyPatch(map, { substeps: { under: '3', steps: ['Data model', 'Route picture'] } }, T0)
  expect(focusLabel(map)).toBe('3.1')
  map = applyPatch(map, { detour: { title: 'Image key bug', why: 'Images did not refit' } }, T0)
  expect(focusLabel(map)).toBe('3.1.1')
  expect(breadcrumb(map)).toBe('3 atlas › 3.1 Data model › 3.1.1 Image key bug')
  // Finishing the detour returns to its parent step.
  map = applyPatch(map, { done: { outcome: 'Key by size' } }, T0)
  expect(focusLabel(map)).toBe('3.1')
  // Finishing a sub-step moves to the next sibling, then back to the parent once none is left.
  map = applyPatch(map, { done: {} }, T0)
  expect(focusLabel(map)).toBe('3.2')
  map = applyPatch(map, { done: { outcome: 'Route renders' } }, T0)
  expect(focusLabel(map)).toBe('3')
  expect(map.trail.map(t => t.kind)).toEqual(['note', 'done', 'done', 'done'])
})

test('parking keeps tangents with where they came from', async () => {
  let map = applyPatch(EMPTY, { steps: ['Load', 'Normalize'] }, T0)
  map = applyPatch(map, { park: ['Try CLAHE later', 'Check speaker labels'] }, T0)
  expect(map.parked.map(p => p.from)).toEqual(['Load', 'Load'])
  map = applyPatch(map, { unpark: [1] }, T0)
  expect(map.parked.map(p => p.text)).toEqual(['Check speaker labels'])
  expect(bandLine(map, false)).toBe('▶ 1 Load  ·  1 parked')
})

test('a drift note sticks to its step, and Keep going silences that step', async () => {
  let map = applyPatch(EMPTY, { steps: ['Load', 'Normalize'] }, T0)
  map = applyPatch(map, { drift: { note: 'Two turns on fonts' } }, T0)
  expect(map.drift?.nodeId).toBe(focusNodes(map)[0]?.id)
  map = { ...map, drift: null, keepGoing: [focusNodes(map)[0]?.id ?? ''] }
  map = applyPatch(map, { drift: { note: 'Still fonts' } }, T0 + 1)
  expect(map.drift).toBe(null)
})

test('facts remember their previous value, and an empty string deletes', async () => {
  let map = applyPatch(EMPTY, { facts: { 'Input shape': '(B, T, 64, 128)' }, pin: ['Input shape'] }, T0)
  map = applyPatch(map, { facts: { 'Input shape': '(B, T, 1, 64, 128)' } }, T0 + 5)
  expect(map.facts['Input shape']).toEqual({ value: '(B, T, 1, 64, 128)', changedAt: T0 + 5, was: '(B, T, 64, 128)' })
  map = applyPatch(map, { facts: { 'Input shape': '' } }, T0 + 6)
  expect(map.pinned).toEqual([])
})

test('maps saved with flat steps migrate into the tree', async () => {
  const old = { goal: 'G', steps: [{ title: 'A', status: 'done' }, { title: 'B', status: 'doing' }], current: 1 }
  const map = migrate(old)
  expect(map.plan.map(n => n.title)).toEqual(['A', 'B'])
  expect(focusLabel(map)).toBe('2')
  expect(isEmpty(migrate(undefined))).toBe(true)
})

test('the markdown dump shows the tree with paths and which stages were looked at', async () => {
  let map = applyPatch(EMPTY, { goal: 'G', steps: ['A', 'B'], stages: [{ name: 'S1', figure: 1 }, { name: 'S2', figure: 2 }] }, T0)
  map = applyPatch(map, { substeps: { under: '1', steps: ['A one'] } }, T0)
  const md = toMarkdown(map, [1])
  expect(md).toContain('1.1 [doing] A one   ← focus')
  expect(md).toContain('- S1: [seen (figure #1)]')
  expect(md).toContain('- S2: [figure #2, not looked at yet]')
})

test('watchdog replies are parsed strictly', async () => {
  const reply = 'Sure. {"focus": "3.2", "detour": {"title": "Fix fonts", "why": "Labels unreadable"}, "recap": {"where": "W", "learned": "L", "next": "N"}, "trail": [{"kind": "bogus", "text": "x"}, {"kind": "decision", "text": "Use sans maths"}], "drift": null}'
  expect(parseWatch(reply)).toEqual({
    focus: '3.2',
    detour: { title: 'Fix fonts', why: 'Labels unreadable' },
    recap: { where: 'W', learned: 'L', next: 'N' },
    drift: null,
    trail: [{ kind: 'decision', text: 'Use sans maths' }],
  })
  expect(parseWatch('no json here')).toBeUndefined()
  expect(parseWatch('{"focus": "three"}')).toBeUndefined()
})

test('the pane invites a map while empty', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'atlas',
      surface,
      component: 'Pane',
      requestId: 'atlas',
      props: { title: 'atlas', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
      viewport: { columns: 160, rows: 40 },
    })
    expect(await ui.find({ type: 'Text', text: /No map for this project yet/ })).toBeDefined()
    await ui.unmount()
  }
})
