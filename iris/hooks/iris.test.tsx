import { expect, test } from 'claude-code/testing'

import { packHalfBlocks, TERMINAL_DEFAULT, UPPER_HALF } from './raster'
import { basename, cropWindow, dirname, extOf, fitCells, parsePages, tail } from './render'

const words = (cells: string) => Array.from(new Uint32Array(Uint8Array.fromBase64(cells).buffer))

test('half blocks put the top pixel in front and the bottom pixel behind', async () => {
  // 2 wide, 4 tall: red/green over blue/white, then black/grey over yellow/cyan.
  const rgb = Uint8Array.of(
    255, 0, 0, 0, 255, 0,
    0, 0, 255, 255, 255, 255,
    0, 0, 0, 128, 128, 128,
    255, 255, 0, 0, 255, 255,
  )
  const out = packHalfBlocks(rgb, 2, 4)
  expect(out.columns).toBe(2)
  expect(out.rows).toBe(2)
  expect(words(out.cells)).toEqual([
    UPPER_HALF, 0xff0000, 0x0000ff,
    UPPER_HALF, 0x00ff00, 0xffffff,
    UPPER_HALF, 0x000000, 0xffff00,
    UPPER_HALF, 0x808080, 0x00ffff,
  ])
})

test('an odd height leaves the last bottom half at the terminal default', async () => {
  const out = packHalfBlocks(Uint8Array.of(1, 2, 3), 1, 1)
  expect(out.rows).toBe(1)
  expect(words(out.cells)).toEqual([UPPER_HALF, 0x010203, TERMINAL_DEFAULT])
})

test('path helpers', async () => {
  expect(extOf('/a/b/fig.TEX')).toBe('tex')
  expect(extOf('/a/b/noext')).toBe('')
  expect(basename('/a/b/fig.pdf')).toBe('fig.pdf')
  expect(dirname('/a/b/fig.pdf')).toBe('/a/b')
  expect(dirname('/fig.pdf')).toBe('/')
})

test('pdfinfo page count and error tails', async () => {
  expect(parsePages('Title: x\nPages:          12\nEncrypted: no')).toBe(12)
  expect(parsePages('garbage')).toBe(1)
  expect(tail('a\nb\nc\n', 2)).toBe('b\nc')
})

test('the pane says how to add a figure while empty', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'iris',
      surface,
      component: 'Pane',
      requestId: 'iris',
      props: { title: 'iris', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
      viewport: { columns: 160, rows: 40 },
    })
    expect(await ui.find({ type: 'Text', text: /No figures yet/ })).toBeDefined()
    await ui.unmount()
  }
})

test('fitCells keeps the aspect inside the box (a cell is twice as tall as wide)', async () => {
  // A square picture in a wide box: limited by rows.
  expect(fitCells(100, 100, 80, 20)).toEqual({ columns: 40, rows: 20 })
  // A wide picture: limited by columns.
  expect(fitCells(400, 100, 80, 40)).toEqual({ columns: 80, rows: 10 })
  // A tall picture: limited by rows, narrow columns.
  expect(fitCells(100, 800, 80, 40)).toEqual({ columns: 10, rows: 40 })
})

test('cropWindow stays inside the image at the edges', async () => {
  expect(cropWindow(1000, 500, 2, 0.5, 0.5)).toEqual({ cw: 500, ch: 250, x: 250, y: 125 })
  expect(cropWindow(1000, 500, 2, 0, 0)).toEqual({ cw: 500, ch: 250, x: 0, y: 0 })
  expect(cropWindow(1000, 500, 4, 1, 1)).toEqual({ cw: 250, ch: 125, x: 750, y: 375 })
})
