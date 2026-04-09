// Session log PDF export preamble
// Used by Gale at session end: generates a .typ that imports this preamble
// then includes the converted markdown content.
//
// Usage: typst compile <project>--session-log-export.typ

#import "@local/diagrams:0.1.0": *

#set document(date: auto)
#set page(paper: "a4", margin: (x: 25mm, y: 30mm), numbering: "1")
#set text(font: "New Computer Modern", size: 10pt, lang: "en")
#set heading(numbering: "1.1")
#set par(justify: true)
#set figure(supplement: [Fig.])
#set figure.caption(separator: [. ])
#show figure: set block(breakable: false)
#show ref: it => {
  let el = it.element
  if el != none and el.func() == figure { [Fig. #it] } else { it }
}

#show heading.where(level: 1): it => {
  pagebreak(weak: true)
  text(weight: "bold", size: 14pt, it)
  v(0.3em)
}
#show heading.where(level: 2): set text(size: 12pt)
#show link: set text(fill: rgb("#2563eb"))
#show raw.where(block: true): set text(size: 9pt)
