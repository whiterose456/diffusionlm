import { useEffect, useRef, useState } from "react";
import { useInView, prefersReducedMotion } from "./motion";

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mono = { fontFamily: "IBM Plex Mono, monospace" } as const;

/* ───────────────────────── β / ᾱ schedule ───────────────────────── */
const T = 1000;
function computeSchedule() {
  const s = 0.008;
  const f = (u: number) => Math.cos(((u + s) / (1 + s)) * (Math.PI / 2)) ** 2;
  const beta: number[] = [];
  const ab: number[] = [];
  let prev = f(0);
  for (let t = 1; t <= T; t++) {
    const cur = f(t / T);
    beta.push(Math.min(0.999, 1 - cur / prev));
    prev = cur;
  }
  let acc = 1;
  for (const b of beta) {
    acc *= 1 - b;
    ab.push(acc);
  }
  return { beta, ab };
}
const SCHED = computeSchedule();

export function ScheduleChart() {
  const [hov, setHov] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const Wd = 640;
  const Hd = 230;
  const L = 46;
  const R = 14;
  const B = 30;
  const Tp = 14;
  const x = (i: number) => L + (i / (T - 1)) * (Wd - L - R);
  const y = (v: number) => Tp + (1 - v) * (Hd - Tp - B);

  const path = (arr: number[], step = 8) => {
    let d = "";
    for (let i = 0; i < T; i += step) d += `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(arr[i]).toFixed(1)}`;
    return d + `L${x(T - 1).toFixed(1)},${y(arr[T - 1]).toFixed(1)}`;
  };

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const fx = ((e.clientX - r.left) / r.width) * Wd;
    const i = Math.round(((fx - L) / (Wd - L - R)) * (T - 1));
    setHov(i >= 0 && i < T ? i : null);
  };

  const ticks = [0, 250, 500, 750, 999];
  return (
    <div ref={ref} className="relative" onMouseMove={onMove} onMouseLeave={() => setHov(null)}>
      <svg viewBox={`0 0 ${Wd} ${Hd}`} className="w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={L} x2={Wd - R} y1={y(v)} y2={y(v)} stroke="#22393d" strokeWidth="1" strokeDasharray="3 5" />
            <text x={L - 8} y={y(v) + 3.5} textAnchor="end" fontSize="9.5" fill="#5e7572" style={mono}>
              {v.toFixed(2)}
            </text>
          </g>
        ))}
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={Hd - 10} textAnchor="middle" fontSize="9.5" fill="#5e7572" style={mono}>
            t={t}
          </text>
        ))}
        <path d={`${path(SCHED.ab)}L${x(T - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill="rgba(69,208,190,0.07)" />
        <path d={path(SCHED.beta)} fill="none" stroke="#f0a63a" strokeWidth="1.8" />
        <path d={path(SCHED.ab)} fill="none" stroke="#45d0be" strokeWidth="2" />
        {hov !== null && (
          <g>
            <line x1={x(hov)} x2={x(hov)} y1={Tp} y2={Hd - B} stroke="#9db4b0" strokeWidth="1" strokeDasharray="2 3" />
            <circle cx={x(hov)} cy={y(SCHED.beta[hov])} r="3.4" fill="#f0a63a" />
            <circle cx={x(hov)} cy={y(SCHED.ab[hov])} r="3.4" fill="#45d0be" />
          </g>
        )}
      </svg>
      <div className="flex flex-wrap items-center gap-4 px-2 pb-1 font-mono text-[11px] text-mist-400">
        <span className="flex items-center gap-1.5"><i className="h-[3px] w-4 bg-amber-400" /> β_t (cosine)</span>
        <span className="flex items-center gap-1.5"><i className="h-[3px] w-4 bg-aqua-400" /> ᾱ_t (signal kept)</span>
        {hov !== null && (
          <span className="ml-auto text-paper-200">
            t={hov} · β={SCHED.beta[hov].toFixed(4)} · ᾱ={SCHED.ab[hov].toFixed(4)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── training loss ───────────────────────── */
const LOSS = (() => {
  const rnd = mulberry(11);
  const train: number[] = [];
  const val: number[] = [];
  const n = 200;
  for (let i = 0; i < n; i++) {
    const p = i / (n - 1);
    const base = 0.88 * Math.exp(-p * 5.2) + 0.041;
    const noise = (rnd() - 0.5) * 0.055 * Math.exp(-p * 3);
    train.push(base + noise);
    val.push(base * 1.045 + 0.006 + (rnd() - 0.5) * 0.05 * Math.exp(-p * 2.5));
  }
  return { train, val, n };
})();

export function LossChart({ animateKey }: { animateKey: number }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const [drawn, setDrawn] = useState(false);
  const [hov, setHov] = useState<number | null>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const Wd = 640;
  const Hd = 240;
  const L = 46;
  const R = 14;
  const B = 30;
  const Tp = 12;
  const x = (i: number) => L + (i / (LOSS.n - 1)) * (Wd - L - R);
  const y = (v: number) => Tp + (1 - (v - 0) / 1.0) * (Hd - Tp - B);
  const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");

  useEffect(() => {
    setDrawn(false);
    if (prefersReducedMotion()) {
      setDrawn(true);
      return;
    }
    const id = setTimeout(() => setDrawn(true), 60);
    return () => clearTimeout(id);
  }, [animateKey, inView]);

  const onMove = (e: React.MouseEvent) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const fx = ((e.clientX - r.left) / r.width) * Wd;
    const i = Math.round(((fx - L) / (Wd - L - R)) * (LOSS.n - 1));
    setHov(i >= 0 && i < LOSS.n ? i : null);
  };

  const stepOf = (i: number) => Math.round((i / (LOSS.n - 1)) * 400);

  return (
    <div ref={ref}>
      <div ref={svgRef} className="relative" onMouseMove={onMove} onMouseLeave={() => setHov(null)}>
        <svg viewBox={`0 0 ${Wd} ${Hd}`} className="w-full">
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line x1={L} x2={Wd - R} y1={y(v)} y2={y(v)} stroke="#22393d" strokeWidth="1" strokeDasharray="3 5" />
              <text x={L - 8} y={y(v) + 3.5} textAnchor="end" fontSize="9.5" fill="#5e7572" style={mono}>
                {v.toFixed(2)}
              </text>
            </g>
          ))}
          {[0, 100, 200, 300, 400].map((k) => (
            <text key={k} x={x((k / 400) * (LOSS.n - 1))} y={Hd - 10} textAnchor="middle" fontSize="9.5" fill="#5e7572" style={mono}>
              {k}K
            </text>
          ))}
          <path className={`chart-draw ${drawn ? "drawn" : ""}`} d={path(LOSS.val)} fill="none" stroke="#5e7572" strokeWidth="1.6" />
          <path className={`chart-draw ${drawn ? "drawn" : ""}`} d={path(LOSS.train)} fill="none" stroke="#f0a63a" strokeWidth="2.1" />
          {hov !== null && (
            <g>
              <line x1={x(hov)} x2={x(hov)} y1={Tp} y2={Hd - B} stroke="#9db4b0" strokeWidth="1" strokeDasharray="2 3" />
              <circle cx={x(hov)} cy={y(LOSS.train[hov])} r="3.4" fill="#f0a63a" />
              <circle cx={x(hov)} cy={y(LOSS.val[hov])} r="3.4" fill="#5e7572" />
            </g>
          )}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-4 px-2 pb-1 font-mono text-[11px] text-mist-400">
        <span className="flex items-center gap-1.5"><i className="h-[3px] w-4 bg-amber-400" /> train</span>
        <span className="flex items-center gap-1.5"><i className="h-[3px] w-4 bg-mist-600" /> val</span>
        <span className="ml-auto text-paper-200">
          {hov !== null
            ? `step ${stepOf(hov)}K · train ${LOSS.train[hov].toFixed(4)} · val ${LOSS.val[hov].toFixed(4)}`
            : "final: train 0.0412 · val 0.0431"}
        </span>
      </div>
    </div>
  );
}

/* ───────────────────────── embedding PCA scatter ───────────────────────── */
const CLUSTERS = [
  { name: "function", color: "#45d0be", cx: 0.24, cy: 0.3, tokens: ["the", "of", "and", "to", "in", "was", "for", "on", "with", "that", "at", "by"] },
  { name: "verbs", color: "#f0a63a", cx: 0.68, cy: 0.26, tokens: ["run", "said", "make", "take", "went", "see", "know", "get", "think", "came", "give", "find"] },
  { name: "nouns", color: "#e2604c", cx: 0.62, cy: 0.7, tokens: ["time", "world", "model", "space", "water", "city", "system", "paper", "noise", "token", "energy", "field"] },
  { name: "subwords", color: "#9db4b0", cx: 0.26, cy: 0.74, tokens: ["##ing", "##ed", "##tion", "##ly", "##er", "##ment", "##al", "##ous", "##ity", "##ance", "##ure", "##ism"] },
];

const POINTS = (() => {
  const rnd = mulberry(23);
  const pts: { x: number; y: number; token: string; cluster: string; color: string }[] = [];
  for (const c of CLUSTERS) {
    for (const token of c.tokens) {
      const a = rnd() * Math.PI * 2;
      const r = 0.02 + rnd() * 0.11;
      pts.push({ x: c.cx + Math.cos(a) * r * 1.25, y: c.cy + Math.sin(a) * r, token, cluster: c.name, color: c.color });
    }
  }
  return pts;
})();

export function EmbeddingScatter() {
  const [hov, setHov] = useState<number | null>(null);
  const Wd = 640;
  const Hd = 320;
  const M = 34;
  const px = (v: number) => M + v * (Wd - M * 2);
  const py = (v: number) => M + v * (Hd - M * 2);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${Wd} ${Hd}`} className="w-full">
        <line x1={M} x2={Wd - M} y1={Hd / 2} y2={Hd / 2} stroke="#22393d" strokeDasharray="3 5" />
        <line x1={Wd / 2} x2={Wd / 2} y1={M} y2={Hd - M} stroke="#22393d" strokeDasharray="3 5" />
        <text x={Wd - M} y={Hd / 2 - 8} textAnchor="end" fontSize="9.5" fill="#5e7572" style={mono}>PC1 →</text>
        <text x={Wd / 2 + 8} y={M + 12} fontSize="9.5" fill="#5e7572" style={mono}>PC2 ↑</text>
        {POINTS.map((p, i) => (
          <circle
            key={i}
            cx={px(p.x)}
            cy={py(p.y)}
            r={hov === i ? 7 : 4}
            fill={p.color}
            fillOpacity={hov === null ? 0.75 : hov === i ? 1 : 0.28}
            stroke={hov === i ? "#f2f4eb" : "none"}
            strokeWidth="1.4"
            style={{ transition: "r .18s ease, fill-opacity .18s ease", cursor: "crosshair" }}
            onMouseEnter={() => setHov(i)}
            onMouseLeave={() => setHov(null)}
          />
        ))}
      </svg>
      {hov !== null && (
        <div
          className="pointer-events-none absolute z-10 border border-line bg-ink-800 px-2.5 py-1.5 font-mono text-[11px] text-paper-100 shadow-xl"
          style={{
            left: `${(px(POINTS[hov].x) / Wd) * 100}%`,
            top: `${(py(POINTS[hov].y) / Hd) * 100}%`,
            transform: "translate(-50%, -135%)",
          }}
        >
          <span style={{ color: POINTS[hov].color }}>●</span> "{POINTS[hov].token}" · {POINTS[hov].cluster}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4 px-2 pb-1 font-mono text-[11px] text-mist-400">
        {CLUSTERS.map((c) => (
          <span key={c.name} className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} /> {c.name}
          </span>
        ))}
        <span className="ml-auto">48 of 50,257 tokens shown</span>
      </div>
    </div>
  );
}

/* ───────────────────────── eval bars ───────────────────────── */
const EVAL = [
  {
    metric: "perplexity ↓",
    note: "lower is better",
    rows: [
      { model: "AR transformer (ours, same budget)", value: 27.1, us: false },
      { model: "diffusion-LM", value: 29.6, us: true },
      { model: "diffusion-LM + CFG w=1.5", value: 28.4, us: true },
    ],
    fmt: (v: number) => v.toFixed(1),
    width: (v: number) => (27.1 / v) * 100,
  },
  {
    metric: "MAUVE ↑",
    note: "distribution quality",
    rows: [
      { model: "AR transformer (ours, same budget)", value: 0.74, us: false },
      { model: "diffusion-LM", value: 0.86, us: true },
      { model: "diffusion-LM + CFG w=1.5", value: 0.91, us: true },
    ],
    fmt: (v: number) => v.toFixed(2),
    width: (v: number) => (v / 0.91) * 100,
  },
  {
    metric: "distinct-2 ↑",
    note: "lexical diversity",
    rows: [
      { model: "AR transformer (ours, same budget)", value: 0.61, us: false },
      { model: "diffusion-LM", value: 0.73, us: true },
      { model: "diffusion-LM + CFG w=1.5", value: 0.77, us: true },
    ],
    fmt: (v: number) => v.toFixed(2),
    width: (v: number) => (v / 0.77) * 100,
  },
];

export function EvalBars() {
  const { ref, inView } = useInView<HTMLDivElement>(0.25);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setOn(true);
      return;
    }
    const id = setTimeout(() => setOn(true), 120);
    return () => clearTimeout(id);
  }, [inView]);

  return (
    <div ref={ref} className="space-y-7">
      {EVAL.map((g) => (
        <div key={g.metric}>
          <div className="mb-2.5 flex items-baseline justify-between">
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-paper-100">{g.metric}</span>
            <span className="font-mono text-[10.5px] text-mist-600">{g.note}</span>
          </div>
          <div className="space-y-2">
            {g.rows.map((r, i) => (
              <div key={r.model} className="group grid grid-cols-[1fr] items-center gap-x-3 sm:grid-cols-[240px_1fr_52px]">
                <span className={`truncate font-mono text-[11px] ${r.us ? "text-amber-300" : "text-mist-400"}`}>{r.model}</span>
                <div className="h-[18px] w-full bg-ink-700/60">
                  <div
                    className={`bar-grow h-full ${r.us ? "bg-amber-400 group-hover:bg-amber-300" : "bg-mist-600 group-hover:bg-mist-400"}`}
                    style={{ width: on ? `${Math.min(100, g.width(r.value))}%` : "0%", transitionDelay: `${i * 130}ms` }}
                  />
                </div>
                <span className="text-right font-mono text-[12px] font-semibold text-paper-100">{g.fmt(r.value)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── architecture diagram ───────────────────────── */
export function ArchDiagram() {
  const box = (x: number, y: number, w: number, h: number, label: string, sub: string, accent: string) => (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#132124" stroke={accent} strokeWidth="1.4" />
      <text x={x + w / 2} y={y + h / 2 - 3} textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#eaedde" style={mono}>
        {label}
      </text>
      <text x={x + w / 2} y={y + h / 2 + 13} textAnchor="middle" fontSize="9" fill="#9db4b0" style={mono}>
        {sub}
      </text>
    </g>
  );
  const arrow = (x1: number, y1: number, x2: number, y2: number, dashed = false) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#45d0be" strokeWidth="1.5" className={dashed ? "flow-dash" : ""} strokeDasharray={dashed ? "6 6" : undefined} />
      <path d={`M${x2},${y2} l-6,-3.4 v6.8 Z`} fill="#45d0be" />
    </g>
  );
  return (
    <div>
      <svg viewBox="0 0 660 210" className="w-full">
        {box(16, 78, 86, 52, "x_t", "noisy emb · B×128×512", "#45d0be")}
        {arrow(102, 104, 132, 104)}
        {box(132, 78, 78, 52, "+ pos", "learned · 128×512", "#45d0be")}
        {arrow(210, 104, 240, 104)}
        {box(240, 78, 62, 52, "⊕", "+ time emb", "#f0a63a")}
        {arrow(302, 104, 332, 104)}
        {box(332, 62, 150, 84, "8× transformer", "d=512 · h=8 · ff 2048", "#f0a63a")}
        {arrow(482, 104, 512, 104)}
        {box(512, 78, 74, 52, "linear", "→ ℝ⁵¹²", "#45d0be")}
        {arrow(586, 104, 616, 104)}
        <text x={628} y={100} fontSize="15" fontWeight="700" fill="#f0a63a" style={mono}>ε̂</text>
        <text x={628} y={116} fontSize="8.5" fill="#9db4b0" style={mono}>noise</text>
        {/* time + prefix side inputs */}
        {box(216, 6, 110, 38, "sinusoid(t)", "→ MLP 4d", "#f0a63a")}
        <line x1={271} y1={44} x2={271} y2={78} stroke="#f0a63a" strokeWidth="1.4" className="flow-dash" strokeDasharray="5 5" />
        <path d="M271,78 l-3.4,-6 h6.8 Z" fill="#f0a63a" />
        {box(40, 160, 130, 38, "prefix c (opt.)", "CFG conditioning", "#9db4b0")}
        <line x1={170} y1={179} x2={366} y2={179} stroke="#9db4b0" strokeWidth="1.2" className="flow-dash" strokeDasharray="5 5" />
        <line x1={366} y1={179} x2={366} y2={146} stroke="#9db4b0" strokeWidth="1.2" className="flow-dash" strokeDasharray="5 5" />
        <path d="M366,146 l-3.4,6 h6.8 Z" fill="#9db4b0" />
      </svg>
      <p className="px-2 pb-1 font-mono text-[11px] text-mist-400">
        38.4M params · input and output both live in ℝ⁵¹² — the denoiser never sees discrete tokens
      </p>
    </div>
  );
}
