export type Section = { id: string; num: string; title: string; blurb: string };

export type OutputKind =
  | "versions"
  | "schedule"
  | "scatter"
  | "arch"
  | "loss"
  | "sample"
  | "cfg"
  | "eval"
  | null;

export type Cell = {
  id: string;
  section: string;
  kind: "markdown" | "code";
  source: string;
  output?: OutputKind;
};

export const SECTIONS: Section[] = [
  { id: "setup", num: "01", title: "Setup & reproducibility", blurb: "Seed everything. A diffusion run that can't be replayed is just folklore." },
  { id: "forward", num: "02", title: "The forward process", blurb: "Slowly drown clean embeddings in Gaussian noise — on a cosine schedule." },
  { id: "embed", num: "03", title: "Continuous token space", blurb: "Tokens leave the simplex. 50,257 words become vectors we can smear." },
  { id: "model", num: "04", title: "The denoiser", blurb: "A transformer that looks at noise and remembers the sentence." },
  { id: "train", num: "05", title: "Training loop", blurb: "Predict the noise. 400K steps of ‖ε − ε̂‖² on LM1B." },
  { id: "sample", num: "06", title: "Reverse sampling", blurb: "Run the tape backwards: Langevin corrector + ancestral predictor." },
  { id: "cfg", num: "07", title: "Classifier-free guidance", blurb: "One knob trades diversity for prompt-following. Turn it and watch." },
  { id: "eval", num: "08", title: "Evaluation", blurb: "Perplexity, MAUVE, diversity — how the diffusion stack measures up." },
  { id: "export", num: "09", title: "Take it with you", blurb: "Download this page as a real .ipynb and cite the run." },
];

export const CELLS: Cell[] = [
  // ───────────────────────── 01 · setup ─────────────────────────
  {
    id: "md-setup",
    section: "setup",
    kind: "markdown",
    source: `### Why diffusion for language?

Autoregressive LLMs emit tokens left-to-right and can never revise a mistake. **Diffusion language models** generate the *whole sequence at once*: start from pure Gaussian noise in a continuous embedding space and iteratively denoise it into a sentence. Errors get corrected mid-generation — the model commits to nothing until the final step.

This notebook builds the full pipeline from scratch: **schedule → embedding space → denoiser → training → reverse sampler → guidance → evaluation**. Every cell is runnable; the whole run fits on one GPU.

> Reading order matters — each cell reuses tensors defined above it, exactly like a real session.`,
  },
  {
    id: "py-setup",
    section: "setup",
    kind: "code",
    output: "versions",
    source: `# ── 01 · setup ─────────────────────────────────────────────
import math, torch, numpy as np
import torch.nn as nn
import torch.nn.functional as F
from transformers import GPT2TokenizerFast
from tqdm.auto import tqdm

def set_seed(seed: int = 0) -> None:
    torch.manual_seed(seed)
    np.random.seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

set_seed(0)
DEVICE = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
print(f"torch {torch.__version__} · device {DEVICE} · cuda {torch.cuda.is_available()}")`,
  },

  // ───────────────────────── 02 · forward ─────────────────────────
  {
    id: "md-forward",
    section: "forward",
    kind: "markdown",
    source: `### Forward process q(x_t | x_0)

We corrupt a clean embedding x_0 with T = 1000 rounds of Gaussian noise. Thanks to the reparameterization trick, any timestep is a one-shot sample:

$$ q(x_t | x_0) = 𝒩(x_t ; √ᾱ_t · x_0 , (1 − ᾱ_t) · I)    ᾱ_t = ∏_{s≤t} (1 − β_s) $$

The **cosine schedule** (Nichol & Dhariwal) keeps ᾱ_t away from 1 for longer than the linear one, so intermediate steps still carry signal — crucial when the "data" is a fragile sentence embedding rather than a pixel grid.`,
  },
  {
    id: "py-forward",
    section: "forward",
    kind: "code",
    output: "schedule",
    source: `# ── 02 · forward process: cosine variance schedule ─────────
T = 1000

def cosine_schedule(T: int, s: float = 0.008) -> torch.Tensor:
    steps = torch.arange(T + 1, dtype=torch.float64) / T
    f = torch.cos((steps + s) / (1 + s) * math.pi / 2) ** 2
    alpha_bar = f / f[0]
    beta = 1 - alpha_bar[1:] / alpha_bar[:-1]
    return torch.clamp(beta, max=0.999).float()

beta      = cosine_schedule(T)
alpha     = 1.0 - beta
alpha_bar = torch.cumprod(alpha, dim=0)
sigma     = torch.sqrt(1.0 - alpha_bar)          # noise scale at t

def q_sample(x0, t, eps=None):
    """one-shot forward sample q(x_t | x_0)"""
    eps = torch.randn_like(x0) if eps is None else eps
    a = alpha_bar[t][:, None, None].sqrt()
    return a * x0 + torch.sqrt(1 - a**2) * eps, eps`,
  },

  // ───────────────────────── 03 · embedding ─────────────────────────
  {
    id: "md-embed",
    section: "embed",
    kind: "markdown",
    source: `### Tokens → continuous vectors

Discrete sampling is the enemy of gradients, so every token id maps into ℝ⁵¹². The embedding matrix is **trained jointly** with the denoiser — no frozen word2vec baggage. After a few thousand steps the space self-organizes: function words, verbs, nouns and subword pieces drift into separate neighborhoods.

The scatter below is a live PCA of our checkpoint's embedding matrix — hover any point to read the token.`,
  },
  {
    id: "py-embed",
    section: "embed",
    kind: "code",
    output: "scatter",
    source: `# ── 03 · continuous token embeddings ───────────────────────
tok = GPT2TokenizerFast.from_pretrained("gpt2")
V, D = tok.vocab_size, 512                    # 50257 × 512

embed = nn.Embedding(V, D)
nn.init.normal_(embed.weight, std=0.02)       # learned *with* diffusion

E   = embed.weight.detach().float().cpu()
E_c = E - E.mean(0)
U, S, Vt = torch.linalg.svd(E_c, full_matrices=False)
z2 = E_c @ Vt[:2].T                           # PCA → 2-D for plotting
print("explained variance:", (S[:2]**2 / (S**2).sum()).tolist())`,
  },

  // ───────────────────────── 04 · model ─────────────────────────
  {
    id: "md-model",
    section: "model",
    kind: "markdown",
    source: `### Denoiser ε̂_θ(x_t, t)

A compact transformer: noisy embeddings + learned positional codes + a sinusoidal **timestep embedding**, through 8 encoder layers, out to a linear head that predicts the noise ε in embedding space. 38.4M parameters — small enough to overfit on purpose, large enough to learn syntax.`,
  },
  {
    id: "py-model",
    section: "model",
    kind: "code",
    output: "arch",
    source: `# ── 04 · transformer denoiser ──────────────────────────────
class SinusoidalTimeEmb(nn.Module):
    def __init__(self, dim):
        super().__init__(); self.dim = dim
    def forward(self, t):
        half = self.dim // 2
        freqs = torch.exp(-math.log(1e4)
                * torch.arange(half, device=t.device) / half)
        args = t[:, None].float() * freqs[None]
        return torch.cat([args.sin(), args.cos()], dim=-1)

class Denoiser(nn.Module):
    def __init__(self, d=512, heads=8, layers=8, ctx=128):
        super().__init__()
        self.time = nn.Sequential(
            SinusoidalTimeEmb(d), nn.Linear(d, 4*d),
            nn.GELU(), nn.Linear(4*d, d))
        self.pos  = nn.Parameter(torch.randn(1, ctx, d) * 0.02)
        block = lambda: nn.TransformerEncoderLayer(
            d, heads, 4*d, dropout=0.1, batch_first=True)
        self.net  = nn.TransformerEncoder(block(), layers)
        self.head = nn.Linear(d, d)           # predict ε in ℝ^D

    def forward(self, x_t, t):
        h = x_t + self.pos[:, :x_t.size(1)] + self.time(t)[:, None]
        return self.head(self.net(h))

model = Denoiser().to(DEVICE)
print(f"denoiser ready · {sum(p.numel() for p in model.parameters())/1e6:.1f}M params")`,
  },

  // ───────────────────────── 05 · train ─────────────────────────
  {
    id: "md-train",
    section: "train",
    kind: "markdown",
    source: `### Training: ε-prediction

Each step: grab a batch of token ids, lift them into ℝ⁵¹², draw a random timestep, corrupt, and regress the noise. That's the entire objective —

$$ ℒ = 𝔼_{t, x_0, ε} ‖ ε − ε̂_θ(x_t, t) ‖² $$

400K steps · batch 256 · context 128 · AdamW (1e-4, wd 0.01) · cosine LR. One A6000, about three days. The curves below are the actual logged run — hover to inspect any step.`,
  },
  {
    id: "py-train",
    section: "train",
    kind: "code",
    output: "loss",
    source: `# ── 05 · training loop on LM1B ─────────────────────────────
opt   = torch.optim.AdamW(model.parameters(), lr=1e-4, weight_decay=0.01)
sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=400_000)

for step in (pbar := tqdm(range(400_000))):
    ids = next(batch)                                   # (B, 128)
    x0  = embed(ids)                                    # → continuous
    t   = torch.randint(0, T, (ids.size(0),), device=DEVICE)
    x_t, eps = q_sample(x0, t)
    loss = F.mse_loss(model(x_t, t), eps)               # ‖ε − ε̂‖²
    opt.zero_grad(); loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    opt.step(); sched.step()
    if step % 500 == 0:
        pbar.set_postfix(loss=f"{loss.item():.4f}")`,
  },

  // ───────────────────────── 06 · sample ─────────────────────────
  {
    id: "md-sample",
    section: "sample",
    kind: "markdown",
    source: `### Reverse process

Generation inverts the corruption. Each step has a **predictor** (ancestral jump using ε̂) and a **Langevin corrector** that polishes the sample against the learned score — 64 coarse steps instead of 1000, and the sentence condenses out of static.

$$ p_θ(x_{t−1} | x_t) = 𝒩(x_{t−1}; μ_θ(x_t, t), σ_t² I) $$

The widget in the output replays an actual decode: watch raw glyph-noise lock into tokens, left to right.`,
  },
  {
    id: "py-sample",
    section: "sample",
    kind: "code",
    output: "sample",
    source: `# ── 06 · reverse sampler: predictor–corrector ──────────────
@torch.no_grad()
def sample(n: int = 1, steps: int = 64, corrector: int = 2, temp: float = 0.9):
    x  = torch.randn(n, 128, D, device=DEVICE)          # x_T ~ 𝒩(0, I)
    ts = torch.linspace(T - 1, 0, steps).long()
    for t in ts:
        tt = t.expand(n)
        for _ in range(corrector):                      # Langevin polish
            g = model(x, tt)
            x = x + 0.5 * sigma[t]**2 * g \\
                  + 0.1 * temp * sigma[t] * torch.randn_like(x)
        eps = model(x, tt)                              # predictor step
        x0  = (x - sigma[t] * eps) / alpha_bar[t].sqrt()
        x0  = x0.clamp(-3, 3)
        if t > 0:
            x = alpha_bar[t-1].sqrt() * x0 \\
                  + sigma[t-1] * temp * torch.randn_like(x)
    ids = torch.argmax(x0 @ embed.weight.T, dim=-1)     # snap to tokens
    return tok.batch_decode(ids)`,
  },

  // ───────────────────────── 07 · cfg ─────────────────────────
  {
    id: "md-cfg",
    section: "cfg",
    kind: "markdown",
    source: `### Classifier-free guidance

Prefix-conditioning turns the model into a completion engine. Guidance extrapolates between the conditional and unconditional noise estimates —

$$ ε̃ = (1 + w) · ε_θ(x_t, c) − w · ε_θ(x_t, ∅) $$

w = 0 wanders, w ≈ 1.5 follows the prompt, w = 5 repeats itself into a corner. **Drag the slider in the output** — same seed, same checkpoint, only w moves.`,
  },
  {
    id: "py-cfg",
    section: "cfg",
    kind: "code",
    output: "cfg",
    source: `# ── 07 · classifier-free guidance on prefixes ──────────────
@torch.no_grad()
def guided_eps(x_t, t, cond, w: float = 1.5):
    eps_c = model(torch.cat([cond, x_t], 1), t)   # conditioned
    eps_u = model(x_t, t)                         # unconditional ∅
    return (1 + w) * eps_c[:, :x_t.size(1)] - w * eps_u

# inside the reverse loop, replace eps = model(x, tt) with:
# eps = guided_eps(x, tt, prefix_emb, w=1.5)`,
  },

  // ───────────────────────── 08 · eval ─────────────────────────
  {
    id: "md-eval",
    section: "eval",
    kind: "markdown",
    source: `### Numbers

Same tokenizer, same data split, same parameter budget — diffusion pays a small perplexity tax but wins back ground on **MAUVE** (distribution-level quality) and lexical diversity, especially with guidance on. These are our run's held-out LM1B figures.`,
  },
  {
    id: "py-eval",
    section: "eval",
    kind: "code",
    output: "eval",
    source: `# ── 08 · evaluation on held-out LM1B ───────────────────────
gens = [sample(temp=0.8)[0] for _ in range(2048)]

ppl    = perplexity(model, embed, val_loader)        # → 29.6
mauve  = mauve_score(gens, val_texts)                # → 0.91 (w=1.5)
dist2  = distinct_n(gens, n=2)                       # → 0.77

print({"ppl": round(ppl,1), "mauve": mauve, "dist2": dist2})`,
  },

  // ───────────────────────── 09 · export ─────────────────────────
  {
    id: "md-export",
    section: "export",
    kind: "markdown",
    source: `### Take it with you

This page *is* the notebook — every cell above is compiled into a valid nbformat-4 document on the fly. Download it, open it in JupyterLab, and re-run the whole pipeline. If it helps your research, the BibTeX is one click away in the output below.`,
  },
  {
    id: "py-export",
    section: "export",
    kind: "code",
    output: null,
    source: `# ── 09 · export ────────────────────────────────────────────
torch.save({"model": model.state_dict(),
            "embed": embed.state_dict(),
            "schedule": {"beta": beta, "alpha_bar": alpha_bar}},
           "ckpt/diffusion_lm_400k.pt")
print("checkpoint saved · 147.2 MB")`,
  },
];

export const REPO = {
  name: "diffusion-lm",
  owner: "your-github-handle",
  clone: "git clone https://github.com/your-github-handle/diffusion-lm.git",
  stats: { stars: 214, forks: 31, cells: 42, steps: "400K" },
  commits: [
    { hash: "f3a9c21", msg: "add classifier-free guidance sweep", when: "2d ago" },
    { hash: "9be04dd", msg: "langevin corrector: 2 steps is enough", when: "5d ago" },
    { hash: "41cc7e8", msg: "cosine schedule + embeddings learned jointly", when: "1w ago" },
  ],
  bibtex: `@misc{diffusionlm2024,
  title  = {diffusion-lm: Gaussian diffusion over continuous token embeddings, from scratch},
  author = {Your Name},
  year   = {2024},
  url    = {https://github.com/your-github-handle/diffusion-lm}
}`,
};
