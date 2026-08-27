import { useCallback, useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./motion";

const W = 720;
const H = 340;
const N = 460;

type P = { nx: number; ny: number; tx: number; ty: number; ph: number; sp: number };

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

/** sample pixel positions of rendered text → condensation targets */
function textTargets(word: string): { x: number; y: number }[] {
  const off = document.createElement("canvas");
  off.width = W;
  off.height = H;
  const c = off.getContext("2d")!;
  c.fillStyle = "#000";
  c.font = "800 150px Syne, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(word, W / 2, H / 2 + 8);
  const data = c.getImageData(0, 0, W, H).data;
  const pts: { x: number; y: number }[] = [];
  for (let y = 0; y < H; y += 4) {
    for (let x = 0; x < W; x += 4) {
      if (data[(y * W + x) * 4 + 3] > 128) pts.push({ x, y });
    }
  }
  return pts;
}

const alphaBarOf = (t: number) => {
  const f = (u: number) => Math.cos(((u + 0.008) / 1.008) * (Math.PI / 2)) ** 2;
  return f(t) / f(0);
};

export default function DiffusionCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const parts = useRef<P[] | null>(null);
  const [t, setT] = useState(0.18);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const tRef = useRef(t);
  const playRef = useRef(playing);
  const dirRef = useRef(1);
  tRef.current = t;
  playRef.current = playing;

  const init = useCallback(() => {
    if (parts.current) return;
    const rnd = mulberry(7);
    const targets = textTargets("LM·∂");
    const pts: P[] = [];
    for (let i = 0; i < N; i++) {
      const tgt = targets.length ? targets[Math.floor(rnd() * targets.length)] : { x: W / 2, y: H / 2 };
      const ang = rnd() * Math.PI * 2;
      const rad = 60 + rnd() * 320;
      pts.push({
        nx: W / 2 + Math.cos(ang) * rad * 1.15,
        ny: H / 2 + Math.sin(ang) * rad * 0.62,
        tx: tgt.x + (rnd() - 0.5) * 3,
        ty: tgt.y + (rnd() - 0.5) * 3,
        ph: rnd(),
        sp: 0.6 + rnd() * 1.6,
      });
    }
    parts.current = pts;
  }, []);

  const draw = useCallback(
    (time: number) => {
      const cv = canvasRef.current;
      const ctx = cv?.getContext("2d");
      if (!cv || !ctx || !parts.current) return;
      ctx.clearRect(0, 0, W, H);
      const base = tRef.current;
      for (const p of parts.current) {
        const local = Math.min(1, Math.max(0, base * 1.2 - p.ph * 0.2));
        const ease = local * local * (3 - 2 * local);
        const wob = (1 - ease) * 9;
        const x = p.nx + (p.tx - p.nx) * ease + Math.sin(time * 0.0011 * p.sp + p.ph * 40) * wob;
        const y = p.ny + (p.ty - p.ny) * ease + Math.cos(time * 0.0009 * p.sp + p.ph * 31) * wob;
        const a = 0.28 + 0.6 * ease;
        ctx.fillStyle =
          ease > 0.55
            ? `rgba(240,166,58,${a})`
            : `rgba(69,208,190,${0.25 + 0.45 * ease})`;
        ctx.fillRect(x, y, ease > 0.8 ? 2.4 : 1.8, ease > 0.8 ? 2.4 : 1.8);
      }
    },
    [],
  );

  useEffect(() => {
    init();
    if (prefersReducedMotion()) {
      draw(0);
      const onFonts = () => {
        parts.current = null;
        init();
        draw(0);
      };
      if (document.fonts?.ready) document.fonts.ready.then(onFonts).catch(() => undefined);
      return;
    }
    // re-sample targets once the display font arrives so glyphs are crisp
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        parts.current = null;
        init();
      }).catch(() => undefined);
    }
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      if (playRef.current) {
        let next = tRef.current + dirRef.current * (dt / 5200);
        if (next >= 1) {
          next = 1;
          dirRef.current = -1;
        } else if (next <= 0) {
          next = 0;
          dirRef.current = 1;
        }
        tRef.current = next;
        setT(next);
      }
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [init, draw]);

  const onScrub = (v: number) => {
    setPlaying(false);
    tRef.current = v;
    setT(v);
    if (prefersReducedMotion()) draw(0);
  };

  const ab = alphaBarOf(t);

  return (
    <div className="tick-corner border border-line bg-ink-900/80">
      {/* panel header */}
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-2.5">
        <div className="flex items-center gap-2 font-mono text-[11px] tracking-wider text-mist-400">
          <svg width="13" height="13" viewBox="0 0 13 13" className="text-aqua-400" aria-hidden>
            <circle cx="6.5" cy="6.5" r="2" fill="currentColor" />
            <ellipse cx="6.5" cy="6.5" rx="5.6" ry="2.4" fill="none" stroke="currentColor" strokeWidth="0.9" transform="rotate(-24 6.5 6.5)" />
            <ellipse cx="6.5" cy="6.5" rx="5.6" ry="2.4" fill="none" stroke="currentColor" strokeWidth="0.9" transform="rotate(24 6.5 6.5)" />
          </svg>
          q-sample playground
        </div>
        <div className="font-mono text-[11px] text-mist-400">
          t = <span className="text-amber-400">{t.toFixed(2)}</span> · ᾱ<sub>t</sub> ={" "}
          <span className="text-aqua-300">{ab.toFixed(3)}</span>
        </div>
      </div>

      <div className="relative">
        <canvas ref={canvasRef} width={W} height={H} className="block w-full" aria-label="Diffusion process: particles condense from Gaussian noise into structure as t approaches 0" />
        {!prefersReducedMotion() && (
          <div className="pointer-events-none absolute left-0 right-0 top-0 h-10 overflow-hidden">
            <div className="scanline h-px w-full bg-gradient-to-r from-transparent via-aqua-400/50 to-transparent" />
          </div>
        )}
        <div className="pointer-events-none absolute bottom-2 left-3 font-mono text-[10px] uppercase tracking-[0.2em] text-mist-600">
          x_T · noise
        </div>
        <div className="pointer-events-none absolute bottom-2 right-3 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-600">
          x_0 · data
        </div>
      </div>

      {/* controls */}
      <div className="flex items-center gap-4 border-t border-line-soft px-4 py-3">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="btn-lab flex h-9 w-9 shrink-0 items-center justify-center border border-line bg-ink-800 text-aqua-300 hover:border-aqua-600 hover:text-aqua-300"
          aria-label={playing ? "Pause diffusion animation" : "Play diffusion animation"}
        >
          {playing ? (
            <svg width="11" height="12" viewBox="0 0 11 12" fill="currentColor" aria-hidden>
              <rect x="1" y="1" width="3.2" height="10" />
              <rect x="6.8" y="1" width="3.2" height="10" />
            </svg>
          ) : (
            <svg width="11" height="12" viewBox="0 0 11 12" fill="currentColor" aria-hidden>
              <path d="M1.5 1l8.5 5-8.5 5z" />
            </svg>
          )}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.005}
          value={t}
          onChange={(e) => onScrub(parseFloat(e.target.value))}
          className="h-1 w-full cursor-ew-resize appearance-none bg-ink-700 accent-amber-400"
          aria-label="Diffusion timestep t — drag from noise to data"
        />
        <div className="hidden shrink-0 font-mono text-[10px] uppercase tracking-widest text-mist-600 sm:block">
          {t > 0.66 ? "noise dominates" : t > 0.33 ? "half-signal" : "structure forms"}
        </div>
      </div>
    </div>
  );
}
