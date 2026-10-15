// Turns a source file into a PNG with the converters installed on this machine.
// Every converter writes its output to a file: $.process hands stdout back as text.

import type { EngineInterface } from 'claude-code'

import { packHalfBlocks, type RasterCells } from './raster'

export const SOURCE_EXTS = ['mmd', 'dot', 'gv', 'tex', 'typ', 'pdf', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] as const
export const TEXT_EXTS = ['mmd', 'dot', 'gv', 'tex', 'typ', 'svg']

export function extOf(path: string): string {
  const dot = path.lastIndexOf('.')
  return dot < 0 ? '' : path.slice(dot + 1).toLowerCase()
}

export function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

export function dirname(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash <= 0 ? '/' : path.slice(0, slash)
}

export function parsePages(pdfinfo: string): number {
  const m = /^Pages:\s+(\d+)/m.exec(pdfinfo)
  return m ? Number(m[1]) : 1
}

/** Last lines of a failed command's output, enough to see the error. */
export function tail(text: string, lines = 25): string {
  return text.trimEnd().split('\n').slice(-lines).join('\n')
}

async function run($: EngineInterface, argv: string[], cwd?: string, timeoutMs = 120_000) {
  const out = await $.process.run(argv, { cwd, timeoutMs })
  if (out.exitCode !== 0) {
    throw new Error(`${argv[0]} failed (exit ${out.exitCode}):\n${tail(out.stderr || out.stdout)}`)
  }
  return out
}

export type Rendered = { pdf?: string; vector?: string; pages: number; page: number; png: string }

/** Renders page `page` of a PDF to `<base>.png`. */
export async function renderPdfPage($: EngineInterface, pdf: string, page: number, base: string): Promise<Rendered> {
  const pages = parsePages((await run($, ['pdfinfo', pdf])).stdout)
  const p = Math.min(Math.max(1, page), pages)
  await run($, ['pdftoppm', '-png', '-r', '200', '-f', String(p), '-l', String(p), '-singlefile', pdf, base])
  return { pdf, vector: pdf, pages, page: p, png: `${base}.png` }
}

/**
 * Renders `src` into `dir` as version `v`. `puppeteer` is the config file
 * mmdc needs on this machine (Chrome's sandbox is blocked by AppArmor).
 */
export async function convert(
  $: EngineInterface,
  src: string,
  dir: string,
  v: number,
  page: number,
  puppeteer: string,
): Promise<Rendered> {
  await run($, ['mkdir', '-p', dir])
  const png = `${dir}/v${v}-p1.png`
  const one = (vector?: string): Rendered => ({ pages: 1, page: 1, png, vector })
  const svg = `${dir}/v${v}.svg`
  const pdf = `${dir}/v${v}.pdf`
  const ext = extOf(src)

  switch (ext) {
    case 'mmd':
      await run($, ['mmdc', '-p', puppeteer, '-i', src, '-o', png, '-b', 'white', '-s', '3', '-q'])
      await run($, ['mmdc', '-p', puppeteer, '-i', src, '-o', svg, '-b', 'white', '-q'])
      return one(svg)
    case 'dot':
    case 'gv':
      await run($, ['dot', '-Tpng', '-Gdpi=200', src, '-o', png])
      await run($, ['dot', '-Tsvg', src, '-o', svg])
      return one(svg)
    case 'svg':
      await run($, ['magick', '-density', '200', '-background', 'white', src, '-flatten', png])
      await run($, ['cp', src, svg])
      return one(svg)
    case 'png':
      await run($, ['cp', src, png])
      return one()
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'bmp':
      await run($, ['magick', `${src}[0]`, png])
      return one()
    case 'pdf':
      await run($, ['cp', src, pdf])
      break
    case 'tex': {
      const out = `${dir}/tex`
      await run($, ['mkdir', '-p', out])
      await run(
        $,
        ['pdflatex', '-interaction=nonstopmode', '-halt-on-error', `-output-directory=${out}`, basename(src)],
        dirname(src),
      )
      await run($, ['cp', `${out}/${basename(src).replace(/\.tex$/i, '.pdf')}`, pdf])
      break
    }
    case 'typ':
      await run($, ['typst', 'compile', src, pdf])
      break
    default:
      throw new Error(`iris can't show .${ext} files (supported: ${SOURCE_EXTS.join(', ')})`)
  }
  return renderPdfPage($, pdf, page, `${dir}/v${v}-p${page}`)
}

/** Pixel width and height of an image file. */
export async function dimsOf($: EngineInterface, file: string): Promise<{ w: number; h: number }> {
  const out = await run($, ['magick', 'identify', '-format', '%w %h', `${file}[0]`])
  const [w, h] = out.stdout.trim().split(/\s+/).map(Number)
  return { w: w || 1, h: h || 1 }
}

/** The window of a zoomed view, in pixels, kept inside the image. */
export function cropWindow(w: number, h: number, z: number, cx: number, cy: number) {
  const cw = Math.max(1, Math.round(w / z))
  const ch = Math.max(1, Math.round(h / z))
  const x = Math.min(Math.max(0, Math.round(cx * w - cw / 2)), w - cw)
  const y = Math.min(Math.max(0, Math.round(cy * h - ch / 2)), h - ch)
  return { cw, ch, x, y }
}

/** Crops `png` to the zoomed window, caching the result beside it. */
export async function crop($: EngineInterface, png: string, w: number, h: number, z: number, cx: number, cy: number) {
  const { cw, ch, x, y } = cropWindow(w, h, z, cx, cy)
  const out = `${png}.crop-${cw}x${ch}+${x}+${y}.png`
  if (!(await $.fs.exists(out))) await run($, ['magick', png, '-crop', `${cw}x${ch}+${x}+${y}`, '+repage', out])
  return { file: out, w: cw, h: ch }
}

/** Cells that show a w x h picture whole inside columns x maxRows; a cell is about twice as tall as wide. */
export function fitCells(w: number, h: number, columns: number, maxRows: number) {
  const aspect = h / w
  let cols = Math.min(columns, 255)
  let rows = Math.max(1, Math.round((cols * aspect) / 2))
  if (rows > maxRows) {
    rows = Math.max(1, maxRows)
    cols = Math.max(1, Math.min(cols, Math.round((rows * 2) / aspect)))
  }
  return { columns: cols, rows: Math.min(rows, 255) }
}

/** Shrinks a PNG to fit `columns` x `maxRows` cells and packs it as half blocks. */
export async function rasterize(
  $: EngineInterface,
  png: string,
  columns: number,
  maxRows: number,
): Promise<RasterCells> {
  const raw = `${png}.${columns}x${maxRows}.rgb`
  const out = await run($, [
    'magick', png,
    '-background', 'white', '-alpha', 'remove', '-alpha', 'off',
    '-resize', `${columns}x${maxRows * 2}`,
    '-dither', 'None', '-colors', '128',
    '-print', '%w %h\n',
    '-depth', '8', `rgb:${raw}`,
  ])
  const [w, h] = out.stdout.trim().split(/\s+/).map(Number)
  const { base64 } = await $.fs.read(raw, { as: 'bytes' })
  return packHalfBlocks(Uint8Array.fromBase64(base64), w ?? columns, h ?? 1)
}
