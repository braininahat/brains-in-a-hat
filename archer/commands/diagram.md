---
name: diagram
description: Create a publication-quality diagram from a description
allowed-tools: Bash, Read, Write
---

Create a publication-quality diagram from the user's description.

## Steps

1. Parse the user's description to identify:
   - What system/architecture is being diagrammed
   - Whether it's a flow/pipeline (fletcher) or structural/dimensional (TikZ)
   - Output format requested (svg/pdf) and output path

2. Decide diagram system:
   - **fletcher**: data flow, pipeline stages, transformer/encoder/decoder blocks, JEPA, CTC
   - **TikZ**: cell internals, lattice structures, geometric/spatial, keypoint graphs

3. Check for the closest existing example:
   - fletcher: `skills/arch-diagram/examples/` (ctc-pipeline, encoder-decoder, multimodal-fusion, jepa-architecture, kan-vs-linear)
   - TikZ: `skills/tikz-render/references/custom-architectures.md` and `references/library-catalog.md`

4. Create the diagram file in `figures/` (or user-specified path):
   - Read the appropriate SKILL.md for the exact API
   - Adapt the closest example rather than writing from scratch
   - Annotate tensor shapes, use semantic colors

5. Compile:
   - fletcher: `typst compile <file>.typ <file>.svg`
   - TikZ: `skills/tikz-render/scripts/compile.sh <file>.tex <file>.svg`

6. Report the output path. If compilation fails, show the error and fix it.

## Usage Examples

```
/diagram Draw the CTC recognition pipeline: poses → CNN1D → BiGRU → CTC → phonemes
/diagram Create a TikZ figure showing BiGRU cell internals with gate labels
/diagram Visualize the multimodal fusion: pose encoder + audio encoder → cross-attention → CTC
```
