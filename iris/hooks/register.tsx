import { atom, read, update } from 'claude-code'
import type { EngineInterface, ImageSource, Register } from 'claude-code'

import type { IrisFigure, IrisImages, IrisVersion, IrisZoom } from '../types'
import { basename, convert, crop, dimsOf, dirname, extOf, fitCells, rasterize, renderPdfPage, TEXT_EXTS } from './render'
import type { RasterCells } from './raster'

const PANE = 'iris'
const TOOL = 'mcp__iris__show'

const figures = atom({ plugin: 'iris', key: 'figures' } as const, [])
const sel = atom({ plugin: 'iris', key: 'sel' } as const, null)
const view = atom({ plugin: 'iris', key: 'view' } as const, 'preview')
const FIT: IrisZoom = { z: 1, cx: 0.5, cy: 0.5 }
const zoom = atom({ plugin: 'iris', key: 'zoom' } as const, FIT)
const images = atom({ plugin: 'iris', key: 'images' } as const, 'unknown' as IrisImages)

const SHOW_DESCRIPTION = [
  'Show a diagram or image to the user in the iris side pane, and get back a PNG of what they see.',
  'Use it whenever a picture helps the user follow along: architecture or data flow (mermaid), graphs (dot),',
  'figures you compiled (.tex, .typ, .pdf, .svg), plots and sample data (.png, .jpg).',
  'Reuse an `id` to add a new version of the same figure while iterating on it.',
  'The pane is a narrow sidebar: prefer top-down layouts (flowchart TB, rankdir=TB) over long left-to-right ones.',
  'After every call, Read the returned PNG and say what is actually visible (layout, labels, anything off)',
  'before claiming anything about the figure.',
].join(' ')

const SHOW_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Short title for the pane header.' },
    caption: { type: 'string', description: 'One line saying what to look at.' },
    mermaid: { type: 'string', description: 'Mermaid source to render.' },
    dot: { type: 'string', description: 'Graphviz dot source to render.' },
    path: {
      type: 'string',
      description: 'File to show: .mmd .dot .gv .tex .typ .pdf .svg .png .jpg .jpeg .gif .webp .bmp. Watched for changes.',
    },
    id: { type: 'string', description: 'Stable figure id. Reusing it adds a version (v2, v3, ...).' },
    page: { type: 'integer', minimum: 1, description: 'PDF page to show (default 1).' },
    page_titles: {
      type: 'array',
      items: { type: 'string' },
      description: 'Title for each PDF page, in order; the header shows only the current page\'s title.',
    },
    save_to: { type: 'string', description: 'Also copy the rendered PNG to this path.' },
  },
  additionalProperties: false,
}

type ShowArgs = {
  title?: string
  caption?: string
  mermaid?: string
  dot?: string
  path?: string
  id?: string
  page?: number
  page_titles?: string[]
  save_to?: string
}

type Shown = { fig: IrisFigure; version: IrisVersion; png: string }

// Module variables are rebuilt on every (re)load: session.start fills them again.
let cwd = '.'
let base = '/tmp/iris'
let watch: { cancel: () => void } | undefined
let isPolling = false
// Debug trace of pane redraws while probing, written to <base>/render-log.jsonl (last 40 entries).
const renderLog: string[] = []
// /show probe: draw the image as a file source and as PNG bytes, to compare how the terminal scales each.
let isProbe = false
// When the renderer was last asked how an Image came out, and the viewport it was asked for.
let probedAt = 0
let probedViewport = ''
const failedMtime = new Map<number, number>()
const rasters = new Map<string, RasterCells | string>()
const dims = new Map<string, { w: number; h: number }>()

const abs = (path: string) => (path.startsWith('/') ? path : `${cwd}/${path}`.replace(/\/\.\//g, '/'))
const figDir = (n: number) => `${base}/${n}`
const pngOf = (version: IrisVersion, page: number) => version.png[String(page)]

async function sh($: EngineInterface, argv: string[]) {
  return $.process.run(argv, { timeoutMs: 30_000 })
}

/** Opens a file in VS Code (inside its terminal) or the desktop viewer, detached. */
async function openExternal($: EngineInterface, file: string) {
  const isVscode = (await $.env.get('TERM_PROGRAM')) === 'vscode'
  const opener = isVscode ? 'code -r "$1"' : 'xdg-open "$1"'
  await sh($, ['sh', '-c', `${opener} >/dev/null 2>&1 &`, 'iris', file])
}

/** The working folder and mmdc's config; recreated whenever missing. */
async function ensureBase($: EngineInterface) {
  const config = `${base}/puppeteer.json`
  if (!(await $.fs.exists(config))) await $.fs.write(config, '{"args":["--no-sandbox"]}\n')
}

async function show($: EngineInterface, args: ShowArgs, isFromWatch = false): Promise<Shown> {
  await ensureBase($)
  const list = await read($, figures)
  const existing = args.id === undefined ? undefined : list.find(f => f.id === args.id)
  const n = existing?.n ?? list.length + 1
  const dir = figDir(n)
  const v = (existing?.versions.length ?? 0) + 1

  let path: string
  let isWatched: boolean
  if (args.mermaid !== undefined || args.dot !== undefined) {
    path = `${dir}/v${v}.${args.mermaid !== undefined ? 'mmd' : 'dot'}`
    await $.fs.write(path, args.mermaid ?? args.dot ?? '')
    isWatched = false
  } else if (args.path !== undefined) {
    path = abs(args.path)
    isWatched = true
  } else if (existing) {
    path = existing.path
    isWatched = existing.isWatched
  } else {
    throw new Error('iris needs one of: mermaid, dot, path')
  }

  const page = args.page ?? existing?.page ?? 1
  const rendered = await convert($, path, dir, v, page, `${base}/puppeteer.json`)
  await sh($, ['cp', rendered.png, `${dir}/current.png`])
  const mtime = isWatched ? (await $.fs.stat(path)).mtimeMs : undefined

  const version: IrisVersion = {
    v,
    at: await $.clock.now(),
    pdf: rendered.pdf,
    vector: rendered.vector,
    pages: rendered.pages,
    png: { [String(rendered.page)]: rendered.png },
  }
  const fig: IrisFigure = {
    n,
    id: existing?.id ?? args.id ?? `fig${n}`,
    title: args.title ?? existing?.title ?? basename(path),
    caption: args.caption ?? existing?.caption,
    path,
    isWatched,
    page: rendered.page,
    pageTitles: args.page_titles ?? existing?.pageTitles,
    mtime,
    versions: [...(existing?.versions ?? []), version],
  }
  await update($, figures, all => [...all.filter(f => f.n !== n), fig].sort((a, b) => a.n - b.n))
  await update($, sel, () => ({ n, v }))
  await update($, view, () => 'preview')
  await update($, zoom, () => FIT)
  failedMtime.delete(n)

  if (args.save_to !== undefined) {
    const target = abs(args.save_to)
    await sh($, ['sh', '-c', 'mkdir -p "$(dirname "$2")" && cp "$1" "$2"', 'iris', rendered.png, target])
  }

  const opened = await $.ui.open({ id: PANE, title: 'iris' })
  if (!opened.isPlaced) {
    $.ui.toast(`iris: #${n} ${fig.title} v${v} ready. /show to view`)
  }
  // Where the pane shows real pixels the full image is already in view; elsewhere open it once per figure.
  if (v === 1 && !isFromWatch && (await read($, images)) === 'none') {
    await openExternal($, `${dir}/current.png`)
  }
  return { fig, version, png: rendered.png }
}

function describe(shown: Shown): string {
  const { fig, version, png } = shown
  const pages = version.pages > 1 ? `, page ${fig.page}/${version.pages}` : ''
  return [
    `Shown in the iris pane as #${fig.n} "${fig.title}" v${version.v}${pages}.`,
    `PNG: ${png}`,
    'Now Read that PNG and tell the user what is actually visible before relying on it.',
  ].join('\n')
}

async function select($: EngineInterface, n: number, v?: number) {
  const fig = (await read($, figures)).find(f => f.n === n)
  if (!fig) return false
  const last = fig.versions.length
  await update($, sel, () => ({ n, v: Math.min(Math.max(1, v ?? last), last) }))
  await update($, zoom, () => FIT)
  return true
}

/** Shows another page of the selected version, rendering it on first use. */
async function flipPage($: EngineInterface, delta: number) {
  const s = await read($, sel)
  const fig = (await read($, figures)).find(f => f.n === s?.n)
  if (fig) await gotoPage($, fig.page + delta)
}

async function gotoPage($: EngineInterface, target: number) {
  const s = await read($, sel)
  const fig = (await read($, figures)).find(f => f.n === s?.n)
  const version = fig?.versions[(s?.v ?? 1) - 1]
  if (!fig || !version?.pdf) return
  const page = Math.min(Math.max(1, target), version.pages)
  if (page === fig.page) return
  let png = pngOf(version, page)
  if (png === undefined) {
    png = (await renderPdfPage($, version.pdf, page, `${figDir(fig.n)}/v${version.v}-p${page}`)).png
  }
  const updated: IrisVersion = { ...version, png: { ...version.png, [String(page)]: png } }
  await update($, figures, all =>
    all.map(f =>
      f.n === fig.n
        ? { ...f, page, versions: f.versions.map(one => (one.v === version.v ? updated : one)) }
        : f,
    ),
  )
}

/** Re-renders watched files whose modification time moved. */
async function poll($: EngineInterface) {
  if (isPolling) return
  isPolling = true
  try {
    for (const fig of await read($, figures)) {
      if (!fig.isWatched) continue
      const stat = await $.fs.stat(fig.path).catch(() => undefined)
      if (!stat || stat.mtimeMs === fig.mtime || stat.mtimeMs === failedMtime.get(fig.n)) continue
      try {
        await show($, { id: fig.id }, true)
      } catch (err) {
        failedMtime.set(fig.n, stat.mtimeMs)
        $.ui.toast(`iris: #${fig.n} changed but failed to render: ${String(err).slice(0, 160)}`)
      }
    }
  } finally {
    isPolling = false
  }
}

async function rasterFor($: EngineInterface, png: string, columns: number, maxRows: number) {
  const key = `${png}|${columns}|${maxRows}`
  let cached = rasters.get(key)
  if (cached === undefined) {
    cached = await rasterize($, png, columns, maxRows).catch(err => `preview failed: ${String(err).slice(0, 200)}`)
    rasters.set(key, cached)
  }
  return cached
}

/** Terminals that draw real pixels (kitty graphics protocol). */
/**
 * Asks the renderer how the Image just drawn came out, and switches to what the viewing terminal can show.
 * The session's own environment says nothing about this: a background session is viewed from another terminal.
 */
async function probeImages($: EngineInterface, key: string, source: ImageSource, box: { columns: number; rows: number }) {
  const now = await $.clock.now()
  if (now - probedAt < 2000) return
  probedAt = now
  await $.clock.sleep(300) // let the frame holding the Image land first
  const r = await $.ui.blit({ requestId: PANE, key, source, columns: box.columns, rows: box.rows }).catch(() => ({ deny: 'failed' }))
  const deny = r.deny ?? ''
  const was = await read($, images)
  let next = was
  if (deny === '') next = 'png' in source ? 'bytes' : 'file'
  // "this terminal cannot read files on this machine ... bytes still draw"
  else if (/cannot read files/.test(deny)) next = 'bytes'
  // "the terminal draws no placeholder images"; not "every image id is in use", which passes
  else if (/draws its alt|not drawn under a terminal/.test(deny) && !/in use/.test(deny)) next = 'none'
  // "has not yet said whether it reads files ... asked now, blit again"
  else if (/blit again/.test(deny)) probedAt = 0
  if (next !== was) {
    await update($, images, () => next)
    $.ui.invalidate('ui.render')
    // One line per change, so how a viewer was judged can be checked afterwards.
    await sh($, ['sh', '-c', 'printf "%s %s -> %s (%s)\\n" "$(date -Is)" "$1" "$2" "$3" >> "$4"', 'iris', was, next, deny || 'drawn', `${base}/images.log`]).catch(() => undefined)
  }
}

/** Whether to draw an Image: yes unless this viewer showed none. A new viewport may be a new viewer, so ask again. */
async function imagesFor($: EngineInterface, viewport: { columns: number; rows: number } | undefined): Promise<boolean> {
  const vp = `${viewport?.columns}x${viewport?.rows}`
  if (vp !== probedViewport) {
    probedViewport = vp
    if ((await read($, images)) === 'none') await update($, images, () => 'unknown' as IrisImages)
  }
  return (await read($, images)) !== 'none'
}

async function cachedDims($: EngineInterface, file: string) {
  let found = dims.get(file)
  if (found === undefined) {
    found = await dimsOf($, file)
    dims.set(file, found)
  }
  return found
}

/** The file the pane shows for the current zoom: the whole render, or a cropped window of it. */
async function zoomed($: EngineInterface, png: string, z: IrisZoom) {
  const full = await cachedDims($, png)
  if (z.z <= 1) return { file: png, ...full }
  return crop($, png, full.w, full.h, z.z, z.cx, z.cy)
}

const ZOOM_STEP = 1.5
const MAX_ZOOM = 12

function zoomBy(factor: number) {
  return (z: IrisZoom): IrisZoom => {
    const next = Math.min(MAX_ZOOM, Math.max(1, z.z * factor))
    return next <= 1.01 ? FIT : { ...z, z: next }
  }
}

/** Moves the view by a quarter of its own size. */
function panBy(dx: number, dy: number) {
  return (z: IrisZoom): IrisZoom => {
    const half = 0.5 / z.z
    const clamp = (c: number) => Math.min(1 - half, Math.max(half, c))
    return { ...z, cx: clamp(z.cx + (dx * 0.25) / z.z), cy: clamp(z.cy + (dy * 0.25) / z.z) }
  }
}

async function sourceText($: EngineInterface, fig: IrisFigure) {
  if (!TEXT_EXTS.includes(extOf(fig.path))) return `${fig.path}\n(binary file: no source to show)`
  const text = await $.fs.read(fig.path).catch(() => '(source file no longer readable)')
  const lines = text.split('\n')
  return lines.length > 200 ? `${lines.slice(0, 200).join('\n')}\n… ${lines.length - 200} more lines` : text
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    cwd = e.cwd
    base = `${(await $.env.get('TMPDIR')) ?? '/tmp'}/iris-${await $.session.id()}`
    await ensureBase($)
    // Renders outlive the process so a resumed session keeps its figures; old ones are pruned here.
    await sh($, ['sh', '-c', 'find "$1" -maxdepth 1 -name "iris-*" -mtime +7 -exec rm -rf {} +', 'iris', dirname(base)]).catch(
      () => undefined,
    )
    await $.tool.register({ name: 'show', description: SHOW_DESCRIPTION, inputSchema: SHOW_SCHEMA, isDeferred: false })
    await $.command.register({
      name: 'show',
      description: 'Open the iris pane. /show <n> selects figure n; /show <path> shows a file.',
      argumentHint: '[n | path]',
    })
    watch?.cancel()
    watch = $.clock.every(1000, () => void poll($))

    return next(e)
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const { tool: _tool, tool_use_id: _id, ...args } = e as unknown as ShowArgs & { tool: string; tool_use_id: string }
    try {
      return { result: describe(await show($, args)) }
    } catch (err) {
      return { deny: `iris could not render it: ${err instanceof Error ? err.message : String(err)}` }
    }
  }).catch(() => ({ deny: 'iris failed while handling the call.' }))

  on('command.run', { command: 'show' }, async ($, e) => {
    const arg = e.args.trim()
    let text = 'iris pane opened.'
    if (arg === 'probe') {
      isProbe = !isProbe
      $.ui.invalidate('ui.render')
      text = `iris probe ${isProbe ? 'on' : 'off'}.`
    } else if (/^#?\d+$/.test(arg)) {
      text = (await select($, Number(arg.replace('#', '')))) ? `Showing #${arg.replace('#', '')}.` : `No figure ${arg}.`
    } else if (arg !== '') {
      try {
        const shown = await show($, { path: arg })
        text = `Showing #${shown.fig.n} ${shown.fig.title}.`
      } catch (err) {
        text = `iris could not render ${arg}: ${err instanceof Error ? err.message : String(err)}`
      }
    }
    await $.ui.open({ id: PANE, title: 'iris' })

    return { text }
  })

  on('prompt.submit', async ($, e, next) => {
    const result = await next(e)
    const s = await read($, sel)
    const fig = (await read($, figures)).find(f => f.n === s?.n)
    const version = fig?.versions[(s?.v ?? 1) - 1]
    if (result.drop !== undefined || !fig || !version) return result
    const line = `iris pane shows #${fig.n} "${fig.title}" v${version.v}/${fig.versions.length} (png: ${pngOf(version, fig.page) ?? ''})`

    return { ...result, context: [...(result.context ?? []), line] }
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.props.tool !== TOOL) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const a = (e.props.input ?? {}) as ShowArgs
    const what = a.title ?? (a.path !== undefined ? basename(a.path) : a.mermaid !== undefined ? 'Mermaid diagram' : a.dot !== undefined ? 'Graphviz diagram' : a.id ?? 'figure')
    const extra = [a.id !== undefined ? `id ${a.id}` : '', a.page !== undefined ? `page ${a.page}` : ''].filter(Boolean).join(' · ')
    return (
      <Box flexDirection="row">
        <Text bold color="#4E79A7">iris</Text>
        <Text dimColor> · Show {what}{extra !== '' ? ` · ${extra}` : ''}</Text>
      </Box>
    )
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const list = await read($, figures)
    const s = await read($, sel)
    const mode = await read($, view)
    const fig = list.find(f => f.n === s?.n)
    const version = fig?.versions[(s?.v ?? 1) - 1]

    if (!fig || !version) {
      return (
        <Box flexDirection="column">
          <Text dimColor>No figures yet. Claude adds them with the show tool; you can type /show path/to/file.</Text>
        </Box>
      )
    }

    const z = await read($, zoom)
    const columns = Math.max(10, e.props.bodyColumns)
    const png = pngOf(version, fig.page) ?? ''
    const count = fig.versions.length
    // Fit the picture into what the pane shows at once: its body less the header and button rows.
    const chrome = 3 + (fig.caption === undefined ? 0 : 1) + (z.z > 1 ? 1 : 0) + (version.pages > 1 ? 1 : 0)
    const fitRows = Math.max(4, e.props.scroll.bodyRows - chrome)
    const zoomLabel = z.z > 1 ? ` · ${z.z.toFixed(1)}×` : ''

    let body
    let indent = 0
    if (mode === 'source') {
      body = <Code source={await sourceText($, fig)} language={extOf(fig.path)} />
    } else if (e.surface === 'terminal') {
      const shown = await zoomed($, png, z).catch(() => undefined)
      if (!shown) {
        body = <Text dimColor>Preview failed. Press o to open the file.</Text>
      } else if (await imagesFor($, e.viewport)) {
        const how = await read($, images)
        const { Image } = $.ui.resolve(e)
        const box = fitCells(shown.w, shown.h, columns, fitRows)
        indent = Math.max(0, Math.floor((columns - box.columns) / 2))
        if (isProbe) renderLog.push(
          JSON.stringify({
            t: await $.clock.now(),
            bodyColumns: e.props.bodyColumns,
            bodyRows: e.props.scroll.bodyRows,
            scrollOffset: e.props.scroll.offset,
            placement: e.props.placement,
            viewport: e.viewport,
            image: { w: shown.w, h: shown.h },
            box,
            indent,
            fitRows,
          }),
        )
        if (renderLog.length > 40) renderLog.shift()
        if (isProbe) void $.fs.write(`${base}/render-log.jsonl`, renderLog.join('\n') + '\n')
        // A keyed Image keeps its first placement size; a new key per box size makes a resize re-place it.
        const key = `preview-${box.columns}x${box.rows}`
        // Same file at a new size must be re-sent: a source equal to the last one sends nothing.
        const source: ImageSource =
          how === 'bytes' ? { png: (await $.fs.read(shown.file, { as: 'bytes' })).base64 } : { file: shown.file, format: 'png', generation: box.columns * 1000 + box.rows }
        body = <Image key={key} source={source} columns={box.columns} rows={box.rows} alt={`#${fig.n} ${fig.title} (press o to open)`} />
        void probeImages($, key, source, box).catch(() => undefined)
        if (isProbe) {
          const half = fitCells(shown.w, shown.h, columns, Math.max(4, Math.floor(fitRows / 2) - 2))
          const { base64 } = await $.fs.read(shown.file, { as: 'bytes' })
          body = (
            <Box flexDirection="column">
              <Text dimColor>Probe A: file source {half.columns}x{half.rows}</Text>
              <Image key="probe-file" source={{ file: shown.file, format: 'png', generation: half.columns * 1000 + half.rows }} columns={half.columns} rows={half.rows} alt="file" />
              <Text dimColor>Probe B: PNG bytes {half.columns}x{half.rows}</Text>
              <Image key="probe-png" source={{ png: base64 }} columns={half.columns} rows={half.rows} alt="png" />
            </Box>
          )
        }
      } else {
        const { Raster } = $.ui.resolve(e)
        const raster = await rasterFor($, shown.file, columns, fitRows)
        body =
          typeof raster === 'string' ? (
            <Text dimColor>{raster}</Text>
          ) : (
            <Raster key="preview" columns={raster.columns} rows={raster.rows} cells={raster.cells} />
          )
      }
    } else {
      body = <Text dimColor>Preview is drawn in the terminal only. Press Open for the full image.</Text>
    }

    const recent = list.slice(-8).reverse()
    const target = version.vector ?? `${figDir(fig.n)}/current.png`

    return (
      <Box flexDirection="column">
        <Text bold>
          #{fig.n} {fig.title}{' '}
          <Text dimColor>
            v{version.v}/{count}
            {version.pages > 1 ? ` · page ${fig.page}/${version.pages}` : ''}
            {fig.pageTitles?.[fig.page - 1] !== undefined ? ` · ${fig.pageTitles[fig.page - 1]}` : ''}
            {zoomLabel}
          </Text>
        </Text>
        {fig.caption !== undefined && <Text dimColor>{fig.caption}</Text>}
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          <Button key="open" hotkey="o" label="Open" onPress={() => openExternal($, target)} />
          <Button
            key="source"
            hotkey="s"
            label={mode === 'source' ? 'Preview' : 'Source'}
            onPress={() => update($, view, m => (m === 'source' ? 'preview' : 'source'))}
          />
          <Button key="zoomin" hotkey="z" label="Zoom +" onPress={() => update($, zoom, zoomBy(ZOOM_STEP))} />
          {z.z > 1 && <Button key="zoomout" hotkey="x" label="Zoom −" onPress={() => update($, zoom, zoomBy(1 / ZOOM_STEP))} />}
          {z.z > 1 && <Button key="fit" hotkey="0" label="Fit" onPress={() => update($, zoom, () => FIT)} />}
          {count > 1 && <Button key="prev" hotkey="p" label="‹ Older" onPress={() => select($, fig.n, version.v - 1)} />}
          {count > 1 && <Button key="next" hotkey="n" label="Newer ›" onPress={() => select($, fig.n, version.v + 1)} />}
          {version.pages > 1 && <Button key="pageup" hotkey="b" label="‹ Page" onPress={() => flipPage($, -1)} />}
          {version.pages > 1 && <Button key="pagedown" hotkey="f" label="Page ›" onPress={() => flipPage($, 1)} />}
        </Box>
        {version.pages > 1 && version.pages <= 40 && (
          // One click per page: rapid repeated clicks read as a double-click and select text.
          <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
            {Array.from({ length: version.pages }, (_, i) => i + 1).map(p => (
              <Button key={`page-${p}`} plain dimColor={p !== fig.page} onPress={() => gotoPage($, p)}>
                {p === fig.page ? `[${p}]` : String(p)}
              </Button>
            ))}
          </Box>
        )}
        {z.z > 1 && (
          <Box flexDirection="row" columnGap={1}>
            <Text dimColor>Pan</Text>
            <Button key="left" hotkey="h" label="←" onPress={() => update($, zoom, panBy(-1, 0))} />
            <Button key="down" hotkey="j" label="↓" onPress={() => update($, zoom, panBy(0, 1))} />
            <Button key="up" hotkey="k" label="↑" onPress={() => update($, zoom, panBy(0, -1))} />
            <Button key="right" hotkey="l" label="→" onPress={() => update($, zoom, panBy(1, 0))} />
          </Box>
        )}
        <Box flexDirection="row" paddingLeft={indent}>
          {body}
        </Box>
        {recent.length > 1 && <Text dimColor>History</Text>}
        {recent.length > 1 &&
          recent.map(one => (
            <Button key={`fig-${one.n}`} plain dimColor={one.n !== fig.n} onPress={() => select($, one.n)}>
              #{one.n} {one.title} <Text dimColor>v{one.versions.length}</Text>
            </Button>
          ))}
      </Box>
    )
  })
}
