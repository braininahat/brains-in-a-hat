# Custom Architecture TikZ Skeletons

Minimal working stubs for architectures with no upstream TikZ template. Extend and style as needed.

All snippets assume `\documentclass[tikz,border=8pt]{standalone}` wrapper with:
```latex
\usetikzlibrary{arrows.meta, positioning, shapes.geometric, fit, calc}
```

---

## BiMamba / Causal Mamba Block

State-space model cell: x_t → SSM gate → h_t. Shows the S4/Mamba state recurrence.

```latex
\begin{tikzpicture}[
  box/.style={draw, rounded corners=3pt, minimum width=2cm, minimum height=0.7cm,
              fill=blue!10, font=\small},
  arr/.style={-Stealth, thick},
  node distance=1.2cm
]
  \node[box] (in)  {$x_t \in \mathbb{R}^d$};
  \node[box, right=of in]  (lin) {Linear proj};
  \node[box, right=of lin] (ssm) {SSM\\$h_t = Ah_{t-1} + Bx_t$};
  \node[box, right=of ssm] (gate){$\sigma$-gate};
  \node[box, right=of gate](out) {$y_t$};
  \node[box, below=0.8cm of ssm] (h) {$h_{t-1}$};

  \draw[arr] (in) -- (lin);
  \draw[arr] (lin) -- (ssm);
  \draw[arr] (ssm) -- (gate);
  \draw[arr] (gate) -- (out);
  \draw[arr] (h) -- (ssm);
  \draw[arr] (ssm.south) to[bend right=30] (h.east);  % recurrence

  % Optional: skip connection
  \draw[arr, dashed] (lin.north) to[out=90,in=90] (gate.north);
  \node[above=0.3cm of ssm, font=\footnotesize\itshape] {selective scan};
\end{tikzpicture}
```

---

## JEPA / V-JEPA2 Masking Diagram

Two-column: context patches → encoder, target patches → EMA encoder, predictor bridges them.

```latex
\begin{tikzpicture}[
  patch/.style={draw, fill=blue!20, minimum size=0.4cm, inner sep=0},
  masked/.style={draw, fill=gray!15, dashed, minimum size=0.4cm, inner sep=0},
  box/.style={draw, rounded corners=3pt, minimum width=1.8cm, minimum height=0.6cm,
              fill=green!15, font=\small},
  arr/.style={-Stealth, thick},
  node distance=0.6cm
]
  % Context patches (visible)
  \foreach \i in {0,...,5} {
    \node[patch] (c\i) at (\i*0.45, 0) {};
  }
  % Target patches (masked)
  \foreach \i in {0,...,3} {
    \node[masked] (t\i) at (\i*0.45+0.1, -1.5) {};
  }

  \node[box, above=0.5cm of c2] (enc) {Encoder $f_\theta$};
  \node[box, above=0.5cm of t1] (ema) {EMA Encoder $\bar{f}_\theta$};
  \node[box, right=1.5cm of enc] (pred){Predictor $g_\phi$};

  \draw[arr] (c0.north) -- (enc.south west);
  \draw[arr] (c5.north) -- (enc.south east);
  \draw[arr] (t0.north) -- (ema.south west);
  \draw[arr] (t3.north) -- (ema.south east);
  \draw[arr] (enc) -- node[above,font=\tiny]{$z_\text{ctx}$} (pred);
  \draw[arr] (pred) -- node[right,font=\tiny]{$\hat{z}$} ++(0,-1);
  \draw[arr] (ema) -- node[above,font=\tiny]{$z_\text{tgt}$} ++(2,0);

  \node[font=\tiny, below=0.1cm of t1] {mask ratio $\rho$};
  \draw[->, dashed, gray] (enc) to[bend left=40] node[above,font=\tiny]{EMA} (ema);
\end{tikzpicture}
```

---

## KAN Layer (Kolmogorov-Arnold Network)

Learnable spline activations on each edge, replacing fixed nonlinearities at nodes.

```latex
\begin{tikzpicture}[
  node/.style={circle, draw, fill=white, minimum size=0.5cm, font=\tiny},
  arr/.style={thick},
  node distance=2cm
]
  % Input nodes
  \foreach \i/\lbl in {0/$x_1$, 1/$x_2$, 2/$x_3$} {
    \node[node] (in\i) at (0, -\i*1.2) {\lbl};
  }
  % Output nodes
  \foreach \i/\lbl in {0/$y_1$, 1/$y_2$} {
    \node[node] (out\i) at (3, -\i*1.2-0.6) {\lbl};
  }
  % Edges with spline annotations
  \foreach \i in {0,1,2} {
    \foreach \j in {0,1} {
      \draw[arr] (in\i) -- (out\j) node[midway, sloped, above, font=\tiny] {$\varphi_{\i\j}$};
    }
  }
  % Spline symbol legend
  \node[draw, rounded corners=2pt, fill=yellow!15, font=\tiny, right=0.3cm of out0]
    {B-spline\\$\varphi(x) = \sum_k c_k B_k(x)$};
\end{tikzpicture}
```

---

## CTC Trellis / Lattice

Time steps × vocab grid. Adapted from mblondel HMM gist pattern.

```latex
\begin{tikzpicture}[
  state/.style={circle, draw, minimum size=0.5cm, font=\tiny},
  blank/.style={circle, draw, fill=gray!20, minimum size=0.5cm, font=\tiny},
  arr/.style={-Stealth, thin, gray}
]
  \def\T{5}   % time steps
  \def\V{4}   % vocab size (excluding blank)

  % Blank row
  \foreach \t in {1,...,\T} {
    \node[blank] (b\t) at (\t*1.1, 0) {\textit{-}};
  }
  % Vocab rows
  \foreach \v/\ph in {1/\textipa{s}, 2/\textipa{i}, 3/\textipa{t}} {
    \foreach \t in {1,...,\T} {
      \node[state] (v\v\t) at (\t*1.1, -\v*0.9) {\ph};
    }
  }

  % Transitions (horizontal + skip blank)
  \foreach \t in {1,...,4} {
    \pgfmathtruncatemacro{\tnext}{\t+1}
    \foreach \v in {1,2,3} {
      \draw[arr] (v\v\t) -- (v\v\tnext);  % stay
    }
    \draw[arr] (b\t) -- (b\tnext);         % blank stay
    % upward transitions (blank → phoneme)
    \foreach \v in {1,2,3} {
      \draw[arr, blue!50] (b\t.south) -- (v\v\tnext.north);
    }
  }
  \node[above=0.1cm of b1, font=\tiny] {$t=1$};
  \node[above=0.1cm of b\T, font=\tiny] {$t=T$};
\end{tikzpicture}
```

**Note**: Requires `\usepackage{tipa}` for IPA symbols, or replace `\textipa{...}` with plain letters.

---

## ST-GCN Tongue Keypoint Graph

16 tongue keypoints (0–10 contour, 11–15 non-tongue) as a graph. Shows adjacency structure.

```latex
\begin{tikzpicture}[
  kp/.style={circle, draw, fill=blue!30, minimum size=0.35cm, inner sep=0, font=\tiny},
  nontongue/.style={circle, draw, fill=red!20, minimum size=0.35cm, inner sep=0, font=\tiny},
  edge/.style={thick, blue!60},
  node distance=0.5cm
]
  % Tongue contour (approximate tongue shape — adjust coords for real anatomy)
  % Indices 0-10: vallecula→root1→root2→body1→body2→dorsum1→dorsum2→blade1→blade2→tip1→tip2
  \node[kp] (k0) at (0, 0)      {0};
  \node[kp] (k1) at (0.6, 0.3)  {1};
  \node[kp] (k2) at (1.1, 0.6)  {2};
  \node[kp] (k3) at (1.5, 1.0)  {3};
  \node[kp] (k4) at (1.8, 1.4)  {4};
  \node[kp] (k5) at (2.0, 1.8)  {5};
  \node[kp] (k6) at (2.1, 2.2)  {6};
  \node[kp] (k7) at (2.0, 2.6)  {7};
  \node[kp] (k8) at (1.8, 3.0)  {8};
  \node[kp] (k9) at (1.5, 3.3)  {9};
  \node[kp] (k10) at (1.2, 3.5) {10};

  % Non-tongue landmarks (11-15)
  \node[nontongue] (k11) at (-0.5, -0.4) {11};  % hyoid
  \node[nontongue] (k12) at (0.2, -0.6)  {12};  % mandible
  \node[nontongue] (k13) at (-0.8, 0.5)  {13};  % shortTendon
  \node[nontongue] (k14) at (-0.6, 1.0)  {14};  % thyroid1
  \node[nontongue] (k15) at (-0.4, 1.5)  {15};  % thyroid2

  % Contour chain edges
  \foreach \i/\j in {0/1, 1/2, 2/3, 3/4, 4/5, 5/6, 6/7, 7/8, 8/9, 9/10} {
    \draw[edge] (k\i) -- (k\j);
  }

  % Legend
  \node[kp, right=2cm of k5] (l1) {};
  \node[right=0.1cm of l1, font=\tiny] {contour (0–10)};
  \node[nontongue, below=0.3cm of l1] (l2) {};
  \node[right=0.1cm of l2, font=\tiny] {non-tongue (11–15)};
\end{tikzpicture}
```

---

## UltraSuite JEPA Pipeline (Full System Diagram)

High-level block diagram: ultrasound frames → spatial encoder → causal Mamba → KAN head → JEPA loss.

```latex
\begin{tikzpicture}[
  block/.style={draw, rounded corners=4pt, minimum width=2.2cm, minimum height=0.8cm,
                fill=#1!15, font=\small, text centered},
  arr/.style={-Stealth, thick},
  node distance=0.3cm and 1.4cm
]
  \node[block=blue]  (frame)   {Frames\\$I \in \mathbb{R}^{T \times H \times W}$};
  \node[block=green, right=of frame]  (spatial) {Spatial Enc\\(ResNet18)};
  \node[block=purple, right=of spatial] (mamba)   {Causal Mamba\\$\times 12$};
  \node[block=orange, right=of mamba]  (kan)     {KAN Head\\(B-spline)};
  \node[block=red, right=of kan]     (loss)    {JEPA Loss\\SIGReg};

  \draw[arr] (frame) -- (spatial);
  \draw[arr] (spatial) -- node[above,font=\tiny]{$z_s \in \mathbb{R}^{T \times d}$} (mamba);
  \draw[arr] (mamba) -- node[above,font=\tiny]{$z_t$} (kan);
  \draw[arr] (kan) -- node[above,font=\tiny]{$\hat{z}$} (loss);

  % EMA target branch
  \node[block=gray, below=1.2cm of mamba] (ema) {EMA Encoder};
  \draw[arr, dashed] (frame.south) to[out=270,in=180] (ema.west);
  \draw[arr] (ema) -- node[right,font=\tiny]{$z_\text{tgt}$} (loss.south);
  \draw[->, dashed, gray!60] (mamba) to[bend right=20]
    node[right,font=\tiny]{EMA $\bar{\theta}$} (ema);
\end{tikzpicture}
```
