# iris

A Claude Code **mod** that shows diagrams and images in a side pane, and makes Claude look at every render.

- Claude calls `show` with Mermaid or Graphviz source, or a file (`.tex .typ .pdf .svg .png .jpg …`). iris renders it to PNG, opens the pane, and tells Claude to read the image back before claiming anything about it.
- Reusing an `id` adds versions (v2, v3 …); watched files re-render when they change on disk.
- Real pixels in terminals with the kitty graphics protocol (Ghostty, kitty); a half-block colour preview elsewhere.
- Pane keys: `o` open the vector original, `s` source, `z`/`x` zoom, `h j k l` pan, `0` fit, `p`/`n` versions, `b`/`f` PDF pages.
- `/show [n | path]` opens the pane, selects a figure, or shows a file.

**Needs:** Claude Code ≥ 2.1.287; ImageMagick (`magick`), Graphviz (`dot`), poppler (`pdftoppm`, `pdfinfo`); optionally `mmdc` (Mermaid CLI), `pdflatex`, `typst`.
