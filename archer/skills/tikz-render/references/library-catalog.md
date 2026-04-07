# TikZ Library Catalog

Reference for existing TikZ templates. Fetch with `curl -L <url> -o fig.tex` then pass to `compile.sh`.

---

## PetarV-/TikZ (MIT License)

Fetch pattern: `curl -L "<raw_url>" -o fig.tex`

| Diagram | Use case | Raw URL |
|---------|----------|---------|
| BiLSTM | Bidirectional RNN encoder | `https://raw.githubusercontent.com/PetarV-/TikZ/master/Bidirectional%20long%20short-term%20memory/bidirectional_long_short-term_memory.tex` |
| LSTM | LSTM cell / sequence model | `https://raw.githubusercontent.com/PetarV-/TikZ/master/Long%20short-term%20memory/long_short-term_memory.tex` |
| Self-Attention | Attention mechanism | `https://raw.githubusercontent.com/PetarV-/TikZ/master/Self-attention/self-attention.tex` |
| Graph Convolution | GCN layer / keypoint graph | `https://raw.githubusercontent.com/PetarV-/TikZ/master/Graph%20convolution/graph_convolution.tex` |
| Message Passing NN | MPNN / ST-GCN message passing | `https://raw.githubusercontent.com/PetarV-/TikZ/master/Message%20passing%20neural%20network/message_passing_neural_network.tex` |
| MLP | Feed-forward network | `https://raw.githubusercontent.com/PetarV-/TikZ/master/Multilayer%20perceptron/multilayer_perceptron.tex` |
| GAN | Adversarial training diagrams | `https://raw.githubusercontent.com/PetarV-/TikZ/master/Generative%20adversarial%20network/generative_adversarial_network.tex` |
| GAT Layer | Graph attention | `https://raw.githubusercontent.com/PetarV-/TikZ/master/GAT%20layer/gat_layer.tex` |
| VAE | Autoencoder / latent space | `https://raw.githubusercontent.com/PetarV-/TikZ/master/Variational%20denoising%20autoencoder/variational_denoising_autoencoder.tex` |
| HMM | Sequence model / CTC base | `https://raw.githubusercontent.com/PetarV-/TikZ/master/GMHMM/gmhmm.tex` |
| Deep Belief Net | Stacked representation learning | `https://raw.githubusercontent.com/PetarV-/TikZ/master/Deep%20belief%20network/deep_belief_network.tex` |

**Note:** PetarV- diagrams use `tikzpicture` + custom macros. May need `\usepackage{pgf,tikz,pgfplots}` and `\usetikzlibrary{arrows,positioning,shapes.geometric}`.

---

## nntikz (MIT License — fraserlove/nntikz)

Fetch pattern: `curl -L "https://raw.githubusercontent.com/fraserlove/nntikz/master/tikz/<file>" -o fig.tex`

| File | Diagram | Use case |
|------|---------|----------|
| `gru.tex` | GRU cell | **BiGRU encoder** — best starting point |
| `lstm.tex` | LSTM cell | LSTM encoder comparison |
| `transformer.tex` | Full Transformer | Encoder/decoder transformer |
| `encoder_only.tex` | Encoder-only Transformer | BERT-style encoder |
| `decoder_only.tex` | Decoder-only Transformer | GPT-style decoder |
| `multihead_attention.tex` | Multi-head attention | Attention mechanism detail |
| `attention.tex` | Attention (general) | Bahdanau/Luong attention |
| `dot_product_attention.tex` | Scaled dot-product | QKV attention detail |
| `rnn_encoder_decoder_sutskever.tex` | Seq2seq | Encoder-decoder CTC context |
| `neural_sequence_model.tex` | Sequence model overview | Pipeline diagram |
| `neural_network.tex` | Generic NN | Dense/projection layers |

**Advantage over PetarV-:** Has `gru.tex` directly; cleaner standalone files; no custom macros needed.

---

## PlotNeuralNet (MIT License — HarisIqbal88/PlotNeuralNet)

**Different workflow — Python generates LaTeX, not direct TikZ.**

```bash
git clone https://github.com/HarisIqbal88/PlotNeuralNet /tmp/plotnn
cd /tmp/plotnn
python3 pyexamples/resnet.py  # generates a .tex file
pdflatex <output>.tex
```

Best for 3D CNN block diagrams (feature map cubes with depth-width-height labeled). Use for the **raw ultrasound encoder** (ResNet18/ConvNeXt spatial encoder visualization).

Key example files to adapt: `pyexamples/resnet.py`, `pyexamples/vgg.py`.

---

## tikz.net/neural_networks (CC BY-SA 4.0 — requires attribution)

URL: `https://tikz.net/neural_networks/`

Available online demos (copy source via "View Source"):
- Self-attention pattern with colored heads
- Convolutional layer visualization
- Dense layer connections

**License note**: CC BY-SA 4.0 — add `% Source: tikz.net/neural_networks, CC BY-SA 4.0` in the file.

---

## mblondel HMM Gist (public domain)

URL: `https://gist.github.com/mblondel/472540`

Provides a clean HMM lattice/trellis in TikZ. Adapt for **CTC alignment diagrams** (time steps × vocab grid with blank token column).

Fetch: `curl -L "https://gist.githubusercontent.com/mblondel/472540/raw/hmm.tex" -o hmm.tex`

---

## Decision Guide: Which Library to Use

| Diagram needed | Recommended source |
|---------------|-------------------|
| BiGRU / BiLSTM encoder | nntikz `gru.tex` or PetarV BiLSTM |
| Transformer | nntikz `transformer.tex` |
| Self-attention detail | PetarV Self-Attention |
| ST-GCN / keypoint graph | PetarV Graph Convolution or MPNN |
| Raw ultrasound CNN encoder | PlotNeuralNet |
| CTC trellis / lattice | mblondel gist → `custom-architectures.md` |
| BiMamba / JEPA / KAN | No template → `custom-architectures.md` |
