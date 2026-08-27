import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./motion";
import { CELLS, REPO } from "../data/notebook";
import { downloadNotebook, copyText } from "../lib/ipynb";

/* ── reverse-sampling replay: glyphs condense into a sentence ── */
const TARGET = "the model glides through continuous space and lands on the nearest token";
const NOISE_CHARS = "∂∇ε≈#%&@§01λξπ*+";

export function TextDiffusion() {
  const [locked, setLocked] = useState(() => (prefersReducedMotion() ? TARGET.length : 0));
  const [frame, setFrame] = useState(0);
  const [runId, setRunId] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    setLocked(0);
    let l = 0;
    const iv = window.setInterval(() => {
      l += 1;
      setLocked(l);
      setFrame((f) => f + 1);
      if (l >= TARGET.length && timer.current === null) {
        window.clearInterval(iv);
      }
    }, 42);
    timer.current = iv;
    return () => {
      window.clearInterval(iv);
      timer.current = null;
    };
  }, [runId]);

  const render = () => {
    let s = TARGET.slice(0, locked);
    for (let i = locked; i < TARGET.length; i++) {
      s += TARGET[i] === " " ? " " : NOISE_CHARS[(frame * 5 + i * 7) % NOISE_CHARS.length];
    }
    return s;
  };

  const done = locked >= TARGET.length;
  return (
    <div className="border border-line-soft bg-ink-950/70">
      <div className="flex items-center justify-between border-b border-line-soft px-3 py-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-mist-400">decode replay · 64 steps → tokens</span>
        <button
          onClick={() => setRunId((r) => r + 1)}
          className="btn-lab btn-run flex items-center gap-1.5 border border-line bg-ink-800 px-2.5 py-1 font-mono text-[11px] text-aqua-300 hover:border-aqua-600"
        >
          <svg width="10" height="11" viewBox="0 0 10 11" fill="currentColor" aria-hidden>
            <path d="M0.8 0.6l8.4 4.9-8.4 4.9z" />
          </svg>
          resample
        </button>
      </div>
      <div className="px-4 py-4 font-mono text-[13.5px] leading-relaxed">
        <span className="mr-2 select-none text-amber-400">»</span>
        <span className={done ? "text-paper-100" : "text-aqua-300/90"}>{render()}</span>
        <span className={`ml-0.5 inline-block h-[15px] w-[7px] translate-y-[2px] bg-amber-400 ${done ? "caret-blink" : ""}`} />
      </div>
      <div className="flex items-center gap-2 border-t border-line-soft px-4 py-2 font-mono text-[10.5px] text-mist-600">
        <span>step {Math.min(64, Math.round((locked / TARGET.length) * 64))}/64</span>
        <span className="h-1 flex-1 bg-ink-700">
          <span className="block h-full bg-aqua-600 transition-[width] duration-150" style={{ width: `${(locked / TARGET.length) * 100}%` }} />
        </span>
        <span>{done ? "snapped to nearest tokens ✓" : "denoising…"}</span>
      </div>
    </div>
  );
}

/* ── classifier-free guidance slider ── */
const CFG_SAMPLES: { max: number; w: string; text: string; note: string }[] = [
  { max: 0.4, w: "0.0", text: "of the and a in to was it he for on with that as his by at from", note: "unconditional — fluent fragments, no destination" },
  { max: 1.0, w: "0.75", text: "the man was one of the house in the morning and the dog", note: "grammar emerges, meaning still drifts" },
  { max: 2.2, w: "1.5", text: "the morning light settled over the harbor as the gulls circled the pier", note: "the sweet spot — coherent and on-prompt" },
  { max: 3.6, w: "3.0", text: "the harbor harbor light settled over over the the pier pier pier pier", note: "over-steering — tokens start to echo" },
  { max: 99, w: "5.0", text: "harbor harbor harbor harbor harbor harbor harbor harbor harbor harbor", note: "mode collapse — guidance ate the diversity" },
];

export function GuidanceWidget() {
  const [w, setW] = useState(1.5);
  const sample = CFG_SAMPLES.find((s) => w <= s.max)!;
  return (
    <div className="border border-line-soft bg-ink-950/70">
      <div className="flex items-center justify-between border-b border-line-soft px-3 py-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-mist-400">same seed · same checkpoint · only w moves</span>
        <span className="font-mono text-[12px] font-semibold text-amber-300">w = {w.toFixed(2)}</span>
      </div>
      <div className="px-4 py-4">
        <input
          type="range"
          min={0}
          max={5}
          step={0.05}
          value={w}
          onChange={(e) => setW(parseFloat(e.target.value))}
          className="h-1 w-full cursor-ew-resize appearance-none bg-ink-700 accent-amber-400"
          aria-label="Classifier-free guidance scale w"
        />
        <div className="mt-1.5 flex justify-between font-mono text-[9.5px] uppercase tracking-widest text-mist-600">
          <span>0 · wanders</span>
          <span>1.5 · follows</span>
          <span>5 · repeats</span>
        </div>
        <p key={sample.w} className="output-in mt-4 border-l-[3px] border-amber-400 bg-ink-800/70 px-4 py-3 font-mono text-[13.5px] leading-relaxed text-paper-100">
          {sample.text}
        </p>
        <p className="mt-2 font-mono text-[11px] text-mist-400">{sample.note}</p>
      </div>
    </div>
  );
}

/* ── export panel: real .ipynb download + citations ── */
function CopyBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }
      }}
      className="btn-lab btn-copy flex items-center gap-1.5 border border-line bg-ink-800 px-3 py-1.5 font-mono text-[11.5px] text-paper-200 hover:border-aqua-600 hover:text-aqua-300"
    >
      {copied ? (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
          <path d="M1.5 6l2.6 2.6L9.5 2.5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
          <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 3V1H1v7h2" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      )}
      {copied ? "copied" : label}
    </button>
  );
}

export function ExportPanel() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="border border-line-soft bg-ink-950/70 p-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-mist-400">notebook</p>
        <p className="mt-2 font-mono text-[13px] text-paper-100">diffusion_lm.ipynb · 42 cells · nbformat 4</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => downloadNotebook(CELLS)}
            className="btn-lab btn-download flex items-center gap-2 border border-amber-600 bg-amber-400 px-3.5 py-1.5 font-mono text-[11.5px] font-semibold text-ink-950 hover:bg-amber-300"
          >
            <svg width="11" height="12" viewBox="0 0 11 12" fill="none" aria-hidden>
              <path d="M5.5 1v7m0 0L2.6 5.2M5.5 8l2.9-2.8M1.5 10.5h8" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            download .ipynb
          </button>
          <CopyBtn text={CELLS.map((c) => c.source.trim()).join("\n\n")} label="copy all code" />
        </div>
      </div>
      <div className="border border-line-soft bg-ink-950/70 p-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-mist-400">cite this run</p>
        <pre className="mt-2 overflow-x-auto font-mono text-[10.5px] leading-relaxed text-mist-300">{REPO.bibtex}</pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyBtn text={REPO.bibtex} label="copy bibtex" />
          <CopyBtn text={REPO.clone} label="copy clone url" />
        </div>
      </div>
    </div>
  );
}

/* ── plain stdout output (versions / logs) ── */
export function StdOut({ lines }: { lines: string[] }) {
  return (
    <div className="border border-line-soft bg-ink-950/70 px-4 py-3 font-mono text-[12.5px] leading-relaxed text-paper-200">
      {lines.map((l, i) => (
        <div key={i} className="whitespace-pre-wrap">{l}</div>
      ))}
    </div>
  );
}
