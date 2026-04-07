---
name: plot-figure
description: This skill should be used when the user asks to "create a plot", "make a chart for the paper", "visualize metrics", "plot training curves", "render an ablation table as a figure", or needs matplotlib/plotly figures exported as SVG for embedding in Typst reports.
---

# Publication-Quality Plot Figures

Render matplotlib or plotly figures as SVG for embedding in Typst reports. Typography matches New Computer Modern so figures integrate seamlessly with the document body.

## Matplotlib: Publication Settings

Apply these settings before any `fig, ax = plt.subplots()` call:

```python
import matplotlib.pyplot as plt
import matplotlib as mpl

mpl.rcParams.update({
    "font.family": "serif",
    "font.serif": ["Computer Modern Roman"],
    "text.usetex": False,          # avoid LaTeX dep; CM font via matplotlib
    "font.size": 9,
    "axes.titlesize": 10,
    "axes.labelsize": 9,
    "xtick.labelsize": 8,
    "ytick.labelsize": 8,
    "legend.fontsize": 8,
    "figure.dpi": 150,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.linewidth": 0.6,
    "xtick.major.width": 0.6,
    "ytick.major.width": 0.6,
    "lines.linewidth": 1.2,
})
```

## Saving as SVG

Always use `tight_layout` before saving. Never use `bbox_inches="tight"` alone — it clips axis labels:

```python
fig, ax = plt.subplots(figsize=(4.5, 3.0))  # inches; A4 column ≈ 3.3in

# ... plot here ...

fig.tight_layout(pad=0.4)
fig.savefig("figures/per-comparison.svg", format="svg", dpi=150,
            bbox_inches="tight", pad_inches=0.02)
plt.close(fig)
```

**figsize guide**:
- Single-column (A4 margin 25mm): `(3.3, 2.5)` inches
- Two-column / full-width: `(6.5, 3.5)` inches
- Side-by-side panel: `(6.5, 2.8)` — use `plt.subplots(1, 2)`

## Color Palette (semantic, matches arch-diagram)

```python
COLORS = {
    "data":      "#e63946",   # red   — input/output
    "encoder":   "#457b9d",   # blue  — encoding
    "decoder":   "#2a9d8f",   # teal  — decoding
    "attention": "#e9c46a",   # yellow — attention
    "loss":      "#e76f51",   # orange — loss curves
    "baseline":  "#adb5bd",   # gray  — baseline/control
}
```

Use `COLORS["encoder"]` for the main model, `COLORS["baseline"]` for ablated/control conditions. Never use matplotlib's default color cycle in paper figures — it carries no semantic meaning.

## Training Curve Template

```python
def plot_training_curve(train_losses, val_pers, output_path):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(6.5, 2.8))

    epochs = range(1, len(train_losses) + 1)

    ax1.plot(epochs, train_losses, color=COLORS["encoder"], label="Train loss")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("CTC loss")
    ax1.set_title("Training loss")

    ax2.plot(epochs, val_pers, color=COLORS["loss"], label="Val PER (%)")
    ax2.axhline(y=min(val_pers), color=COLORS["baseline"], linestyle="--",
                linewidth=0.8, label=f"Best {min(val_pers):.1f}%")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("PER (%)")
    ax2.set_title("Validation PER")
    ax2.legend(frameon=False)

    fig.tight_layout(pad=0.4)
    fig.savefig(output_path, format="svg", dpi=150,
                bbox_inches="tight", pad_inches=0.02)
    plt.close(fig)
```

## Bootstrap CI Errorbar Template

```python
def plot_encoder_comparison(results, output_path):
    """results: list of dicts with keys: name, per, ci_lo, ci_hi, causal"""
    results_sorted = sorted(results, key=lambda r: r["per"])
    names = [r["name"] for r in results_sorted]
    pers = [r["per"] for r in results_sorted]
    yerr_lo = [r["per"] - r["ci_lo"] for r in results_sorted]
    yerr_hi = [r["ci_hi"] - r["per"] for r in results_sorted]
    colors = [COLORS["loss"] if r["causal"] else COLORS["encoder"]
              for r in results_sorted]

    fig, ax = plt.subplots(figsize=(4.0, 3.0))
    ax.barh(names, pers, xerr=[yerr_lo, yerr_hi], color=colors,
            error_kw={"linewidth": 0.8, "capsize": 3}, height=0.55)
    ax.set_xlabel("PER (%)")
    ax.invert_yaxis()
    ax.axvline(x=95, color=COLORS["baseline"], linestyle="--",
               linewidth=0.8, label="Chance (95%)")
    ax.legend(frameon=False)

    fig.tight_layout(pad=0.4)
    fig.savefig(output_path, format="svg", dpi=150,
                bbox_inches="tight", pad_inches=0.02)
    plt.close(fig)
```

## Plotly SVG Export

```python
import plotly.graph_objects as go
import plotly.io as pio

fig = go.Figure(...)
# Publication settings:
fig.update_layout(
    font=dict(family="Computer Modern", size=9),
    plot_bgcolor="white",
    paper_bgcolor="white",
    margin=dict(l=40, r=10, t=30, b=40),
)
pio.write_image(fig, "figures/plot.svg", format="svg", scale=2)
```

Note: plotly SVG requires `kaleido`: `pip install kaleido`.

## Embedding in Typst

```typst
#figure(
  image("figures/per-comparison.svg", width: 90%),
  caption: [PER comparison across encoder types. Error bars are 95% bootstrap CIs (1000 samples, 136 utterances).],
) <fig:per>
```

Use `width: 90%` for full-width, `width: 45%` for two-column panels (see figure-compose skill for multi-panel layout).
