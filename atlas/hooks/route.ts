// The plan as a route line: one station per step, done green, current orange, upcoming grey.

import type { AtlasNode } from '../types'

export const ROUTE_W = 1200
export const ROUTE_H = 210

const COLOUR = { done: '#59A14F', doing: '#F28E2B', todo: '#BAB0AC', dropped: '#BAB0AC', ink: '#222222', muted: '#6B6B6B' }

/** A station's short name: the text before a colon, else the first two words. */
export function shortName(title: string): string {
  const head = title.includes(':') ? title.slice(0, title.indexOf(':')) : title.split(/\s+/).slice(0, 2).join(' ')
  return head.trim()
}

/** Splits a label into at most two lines of about `width` characters. */
export function wrap2(text: string, width = 12): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    if (line === '' || (line + ' ' + w).length <= width) line = line === '' ? w : `${line} ${w}`
    else {
      lines.push(line)
      line = w
    }
  }
  if (line !== '') lines.push(line)
  return lines.length <= 2 ? lines : [lines[0] ?? '', `${lines.slice(1).join(' ').slice(0, width - 1)}…`]
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** `prefix` numbers a sub-route's stations ("3." gives 3.1, 3.2, ...). */
export function routeSvg(steps: readonly AtlasNode[], current: number, prefix = ''): string {
  const n = Math.max(1, steps.length)
  const margin = 115
  const y = 78
  const x = (i: number) => (n === 1 ? ROUTE_W / 2 : margin + (i * (ROUTE_W - 2 * margin)) / (n - 1))
  const parts: string[] = [
    // The font as an inherited attribute, not a <style> block, so a surface that scrubs stylesheets keeps it.
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ROUTE_W}" height="${ROUTE_H}" viewBox="0 0 ${ROUTE_W} ${ROUTE_H}" font-family="'TeX Gyre Heros', Helvetica, Arial, sans-serif">`,
    `<rect width="100%" height="100%" fill="#FFFFFF"/>`,
  ]
  for (let i = 0; i < n - 1; i++) {
    const isDone = steps[i]?.status === 'done' && steps[i + 1]?.status !== 'todo'
    parts.push(`<line x1="${x(i)}" y1="${y}" x2="${x(i + 1)}" y2="${y}" stroke="${isDone ? COLOUR.done : COLOUR.todo}" stroke-width="10" stroke-linecap="round"/>`)
  }
  steps.forEach((s, i) => {
    const isNow = i === current
    const isDetour = s.kind === 'detour'
    const fill = isNow ? COLOUR.doing : s.status === 'done' ? COLOUR.done : '#FFFFFF'
    const stroke = isNow ? COLOUR.doing : s.status === 'done' ? COLOUR.done : COLOUR.todo
    if (isNow) parts.push(`<circle cx="${x(i)}" cy="${y}" r="34" fill="none" stroke="${COLOUR.doing}" stroke-width="4" opacity="0.45"/>`)
    parts.push(`<circle cx="${x(i)}" cy="${y}" r="${isNow ? 24 : 19}" fill="${fill}" stroke="${stroke}" stroke-width="6"/>`)
    const numColour = isNow || s.status === 'done' ? '#FFFFFF' : COLOUR.muted
    const num = `${prefix}${i + 1}`
    const numSize = (isNow ? 26 : 22) - (num.length > 2 ? 6 : 0)
    parts.push(`<text x="${x(i)}" y="${y + 8}" text-anchor="middle" font-size="${numSize}" font-weight="bold" fill="${numColour}">${num}</text>`)
    const lines = wrap2(`${isDetour ? '↪ ' : ''}${shortName(s.title)}`)
    lines.forEach((line, k) => {
      const colour = isNow ? COLOUR.ink : s.status === 'done' ? COLOUR.ink : COLOUR.muted
      parts.push(
        `<text x="${x(i)}" y="${y + 70 + k * 30}" text-anchor="middle" font-size="25" font-weight="${isNow ? 'bold' : 'normal'}" fill="${colour}">${esc(line)}</text>`,
      )
    })
  })
  parts.push('</svg>')
  return parts.join('\n')
}

/** A short stable hash, to name the rendered file after its content. */
export function hash(text: string): string {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}
