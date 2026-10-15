// Packs raw RGB pixels into Raster cells: one upper-half-block glyph per cell,
// its foreground the top pixel and its background the bottom one.

export const UPPER_HALF = 0x2580
export const TERMINAL_DEFAULT = 0x01000000

export type RasterCells = { cells: string; columns: number; rows: number }

export function packHalfBlocks(rgb: Uint8Array, width: number, height: number): RasterCells {
  const rows = Math.ceil(height / 2)
  const words = new Uint32Array(width * rows * 3)
  const pixel = (x: number, y: number) => {
    if (y >= height) return TERMINAL_DEFAULT
    const i = (y * width + x) * 3
    return ((rgb[i] ?? 0) << 16) | ((rgb[i + 1] ?? 0) << 8) | (rgb[i + 2] ?? 0)
  }
  for (let r = 0; r < rows; r++) {
    for (let x = 0; x < width; x++) {
      const w = (r * width + x) * 3
      words[w] = UPPER_HALF
      words[w + 1] = pixel(x, 2 * r)
      words[w + 2] = pixel(x, 2 * r + 1)
    }
  }
  return { cells: new Uint8Array(words.buffer).toBase64(), columns: width, rows }
}
