/** One render of a figure. PDFs keep a snapshot so pages can be flipped later. */
export type IrisVersion = {
  v: number
  at: number
  /** Snapshot of the PDF this version came from (pdf, tex, typ sources). */
  pdf?: string
  pages: number
  /** The vector original Open shows (svg or pdf), zoomable in a viewer. */
  vector?: string
  /** Rendered PNG per page, keyed by page number as a string. */
  png: Record<string, string>
}

export type IrisFigure = {
  /** Display number, #1, #2, ... in order of creation. */
  n: number
  /** Stable id; showing the same id again adds a version. */
  id: string
  title: string
  caption?: string
  /** Absolute path of the source file (inline mermaid/dot is written to one). */
  path: string
  /** True when the source is the user's file, so iris watches it for changes. */
  isWatched: boolean
  page: number
  /** Optional title per PDF page, shown in the header for the current page. */
  pageTitles?: string[]
  mtime?: number
  versions: IrisVersion[]
}

export type IrisSelection = { n: number; v: number } | null

/** In-pane zoom: z = 1 fits the whole image; cx, cy are the view's centre as fractions. */
export type IrisZoom = { z: number; cx: number; cy: number }

declare module 'claude-code' {
  interface PluginState {
    iris: {
      figures: IrisFigure[]
      sel: IrisSelection
      view: 'preview' | 'source'
      zoom: IrisZoom
    }
  }
}
