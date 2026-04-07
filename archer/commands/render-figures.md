---
name: render-figures
description: Compile all .tex and .typ figure files in a directory
allowed-tools: Bash, Read, Glob
---

Compile all `.tex` and `.typ` figure files in a target directory and report results.

## Steps

1. Determine the target directory:
   - If the user specifies a path, use it
   - Default: `figures/` in the current working directory

2. Find all figure files:
   ```bash
   # Find all .typ and .tex files in the target directory
   find <dir> -name "*.typ" -o -name "*.tex"
   ```

3. Compile each file:

   **For `.typ` files** (fletcher/Typst diagrams):
   ```bash
   typst compile <file>.typ <file>.svg
   # or for PDF:
   typst compile <file>.typ <file>.pdf
   ```

   **For `.tex` files** (TikZ diagrams):
   ```bash
   skills/tikz-render/scripts/compile.sh <file>.tex <file>.svg
   ```

4. Track results — for each file record:
   - PASS: compiled successfully, output size > 0
   - FAIL: compilation error (include last 20 lines of error output)

5. Print a summary table:
   ```
   PASS  figures/ctc-pipeline.svg        (12.4 KB)
   PASS  figures/jepa-architecture.svg   (8.7 KB)
   FAIL  figures/bigru-internals.tex     — Missing \usetikzlibrary{arrows.meta}
   ```

6. For any FAIL: attempt the obvious fix (missing package, math mode error) and retry once. If still failing, report the full error without further retries.

## Usage

```
/render-figures              # renders all in figures/
/render-figures paper/       # renders all in paper/
/render-figures --pdf        # compile to PDF instead of SVG
```
