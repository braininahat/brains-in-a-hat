# Dimensional Diagrams — When to Use TikZ

Fletcher handles pipeline flows. TikZ handles dimensionality. This guide helps choose.

## Decision Table

| Need | Tool | Source |
|------|------|--------|
| Pipeline flow (A→B→C) | Fletcher (`ml-diagram`) | Inline in Typst |
| Tensor shape 3D block | TikZ (PlotNeuralNet) | `tikz-to-svg` skill |
| Conv filter visualization | TikZ (PlotNeuralNet) | `tikz-to-svg` skill |
| Attention heatmap | TikZ (PetarV Self-Attention) | `tikz-to-svg` skill |
| LSTM/GRU cell internals | TikZ (nntikz) | `tikz-to-svg` skill |
| Graph convolution on keypoints | TikZ (PetarV GCN/MPNN) | `tikz-to-svg` skill |
| CTC alignment lattice | TikZ (custom) | `tikz-to-svg` custom-architectures.md |
| KAN spline visualization | TikZ (custom) | `tikz-to-svg` custom-architectures.md |
| Side-by-side comparison | Fletcher | Inline `grid(columns: 2)` |
| Dependency graph | Fletcher | Inline with colored paths |

## Workflow: TikZ → SVG → Typst

### Step 1: Write or fetch TikZ source

Check `tikz-to-svg` skill's `references/library-catalog.md` for existing templates:
- **PetarV-/TikZ**: BiLSTM, Self-Attention, GCN, MPNN, GAT, VAE, MLP (11 diagrams)
- **nntikz**: GRU, LSTM, Transformer, Multi-Head Attention (11 diagrams)
- **PlotNeuralNet**: 3D CNN blocks via Python (ResNet, VGG)
- **Custom**: BiMamba, JEPA masking, KAN, CTC trellis, ST-GCN

Fetch example:
```bash
curl -L "https://raw.githubusercontent.com/fraserlove/nntikz/master/tikz/gru.tex" -o figures/gru.tex
```

### Step 2: Compile to SVG

```bash
bash ~/.claude/skills/typst-diagrams/scripts/render-tikz-for-typst.sh figures/gru.tex figures/
```

### Step 3: Import in Typst

```typst
#import "@local/diagrams:0.1.0": *

// Inline fletcher diagram for pipeline
#figure(
  ml-diagram(
    data-in((0,0), [Poses\ #dim[(T, 22)]]),
    edge("-|>"),
    encoder((1,0), [BiGRU]),
    edge("-|>"),
    ctc-head((2,0), [CTC]),
  ),
  caption: [Pipeline overview],
)

// TikZ SVG for detailed GRU cell
#tikz-fig("figures/gru.svg", caption: [BiGRU cell internals])
```

## When to Mix Both in One Report

Use fletcher for the high-level pipeline, TikZ for zoomed-in component detail:

1. Page 1: Fletcher pipeline showing Input → Encoder → Seq → CTC
2. Page 2: TikZ GRU cell showing gate internals (reset, update, candidate)
3. Page 3: TikZ PlotNeuralNet showing (T, 487, 883) → ResNet18 → (T, 256) with 3D blocks
4. Page 4: Fletcher fusion comparison (early vs late, side-by-side)

This "overview + detail" pattern is standard in ML papers (petarv uses it extensively).

## PlotNeuralNet for Tensor Dimensions

PlotNeuralNet generates 3D block diagrams showing tensor shapes. Setup:

```bash
git clone https://github.com/HarisIqbal88/PlotNeuralNet /tmp/plotnn
cd /tmp/plotnn
# Edit pyexamples/your_arch.py to define layers
python3 pyexamples/your_arch.py
# Produces a .tex file — compile with tikz-to-svg
bash ~/.claude/skills/tikz-to-svg/scripts/compile.sh output.tex figures/arch.svg
```

For the PULSE project, typical tensor shapes to visualize:
- Raw ultrasound: (T, 487, 883) uint8
- After spatial encoder: (T, 256) float
- After seq encoder: (T, 256) float
- CTC output: (T, 46) log-probs
- Pose keypoints: (T, 22) mm-space
- Mel spectrogram: (T, 80) float
