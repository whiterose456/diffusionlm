import { useCallback, useEffect, useRef, useState } from "react";
import { CELLS, SECTIONS, REPO, type Cell } from "./data/notebook";
import CellView, { type CellStatus } from "./components/Cell";
import DiffusionCanvas from "./components/DiffusionCanvas";
import { ExportPanel } from "./components/widgets";
import { Reveal, Scramble, prefersReducedMotion } from "./components/motion";
import { downloadNotebook, copyText } from "./lib/ipynb";

type States = Record<string, CellStatus>;

function initialStates(): States {
  const s: States = {};
  let n = 0;
  for (const c of CELLS) {
    if (c.kind === "code") {
      n += 1;
      s[c.id] = { state: "done", count: n, replay: 0 };
    } else {
      s[c.id] = { state: "idle", count: null, replay: 0 };
    }
  }
  return s;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, prefersReducedMotion() ? 40 : ms));

/* ── tiny custom icons ─────────────────────────────────────── */
const IconStar = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
    <path d="M6.5 1.2l1.6 3.3 3.7.5-2.7 2.6.7 3.6-3.3-1.8-3.3 1.8.7-3.6L1.2 5l3.7-.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);
const IconFork = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
    <circle cx="3" cy="2.6" r="1.6" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="10" cy="2.6" r="1.6" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="6.5" cy="10.6" r="1.6" stroke="currentColor" strokeWidth="1.2" />
    <path d="M3 4.2v1.6a2 2 0 002 2h3a2 2 0 002-2V4.2M6.5 7.8v1.2" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);
const IconBook = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
    <path d="M2 2.2A1.7 1.7 0 013.7 1H11v9.5H4A2 2 0 002 12.4z" stroke="currentColor" strokeWidth="1.2" />
    <path d="M2 12.4A1.9 1.9 0 014 10.5h7" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

/* ── top toolbar ───────────────────────────────────────────── */
function TopBar({ busy, onRunAll, running }: { busy: boolean; onRunAll: () => void; running: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ink-950/92 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <a href="#top" className="group flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center border border-aqua-600/60 bg-ink-800 text-aqua-300 transition-colors group-hover:bg-aqua-900">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="8" cy="8" r="1.8" fill="currentColor" />
              <circle cx="8" cy="8" r="5.4" stroke="currentColor" strokeWidth="1.1" strokeDasharray="2.5 2.5" />
              <circle cx="13.4" cy="8" r="1.1" fill="#f0a63a" />
            </svg>
          </span>
          <span className="hidden font-mono text-[12.5px] text-mist-300 sm:block">
            <span className="text-mist-600">{REPO.owner}/</span>
            <span className="font-semibold text-paper-100 group-hover:text-aqua-300 transition-colors">{REPO.name}</span>
          </span>
        </a>
        <span className="hidden items-center gap-1.5 border border-line bg-ink-900 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-mist-400 md:flex">
          <IconBook /> notebook
        </span>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 border border-line bg-ink-900 px-2.5 py-1.5 font-mono text-[11px] text-mist-300">
            <span className={`h-2 w-2 rounded-full ${busy ? "bg-amber-400 pulse-dot" : "bg-aqua-400"}`} />
            <span className="hidden sm:inline">{busy ? "kernel busy" : "Python 3.11 · idle"}</span>
            <span className="sm:hidden">{busy ? "busy" : "idle"}</span>
          </div>
          <button
            onClick={onRunAll}
            disabled={running}
            className="btn-lab btn-runall flex items-center gap-2 border border-aqua-600 bg-aqua-900/60 px-3 py-1.5 font-mono text-[11.5px] font-semibold uppercase tracking-wider text-aqua-300 hover:bg-aqua-900 disabled:opacity-60"
          >
            {running ? (
              <svg className="spin" width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
                <circle cx="5.5" cy="5.5" r="4.4" stroke="currentColor" strokeWidth="1.6" strokeDasharray="18 10" />
              </svg>
            ) : (
              <svg width="10" height="11" viewBox="0 0 10 11" fill="currentColor" aria-hidden>
                <path d="M1 1h1.6v9H1zM4.2 1l5 4.5-5 4.5z" />
              </svg>
            )}
            {running ? "running…" : "run all"}
          </button>
          <button
            onClick={() => downloadNotebook(CELLS)}
            className="btn-lab btn-download hidden items-center gap-2 border border-amber-600 bg-amber-400 px-3 py-1.5 font-mono text-[11.5px] font-semibold uppercase tracking-wider text-ink-950 hover:bg-amber-300 sm:flex"
          >
            <svg width="11" height="12" viewBox="0 0 11 12" fill="none" aria-hidden>
              <path d="M5.5 1v7m0 0L2.6 5.2M5.5 8l2.9-2.8M1.5 10.5h8" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            .ipynb
          </button>
        </div>
      </div>
    </header>
  );
}

/* ── hero ──────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[1.02fr_1fr] lg:gap-12 lg:pt-16">
        <div>
          <Reveal>
            <p className="flex items-center gap-2.5 font-mono text-[11.5px] text-aqua-300">
              <span className="text-amber-400">▸</span> ~/notebooks/diffusion_lm.ipynb
              <span className="hidden text-mist-600 sm:inline">· last commit {REPO.commits[0].when}</span>
            </p>
          </Reveal>
          <h1 className="mt-5 font-display text-[15vw] font-extrabold leading-[0.92] tracking-tight text-paper-50 sm:text-7xl lg:text-[86px]">
            <Scramble text="DIFFUSION" delay={100} />
            <br />
            <span className="text-amber-400">
              <Scramble text="—LM—" delay={550} />
            </span>
          </h1>
          <Reveal delay={150}>
            <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-mist-300">
              A from-scratch Python notebook on <strong className="font-semibold text-paper-100">Gaussian diffusion over continuous token embeddings</strong> — the
              non-autoregressive cousin of the LLM. Noise in, whole sentences out. Every cell on this page compiles into a real{" "}
              <code className="bg-ink-800 px-1.5 py-0.5 font-mono text-[13px] text-aqua-300">.ipynb</code> you can run on one GPU.
            </p>
          </Reveal>

          <Reveal delay={250}>
            <dl className="mt-8 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
              {[
                { k: "cells", v: String(REPO.stats.cells) },
                { k: "train steps", v: REPO.stats.steps },
                { k: "vocab", v: "50,257" },
                { k: "params", v: "38.4M" },
              ].map((s) => (
                <div key={s.k} className="group bg-ink-950 px-4 py-3.5 transition-colors hover:bg-ink-900">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist-600 group-hover:text-aqua-600 transition-colors">{s.k}</dt>
                  <dd className="mt-1 font-display text-[22px] font-bold text-paper-100">{s.v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal delay={350}>
            <div className="mt-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mist-600">recent commits</p>
              <ul className="mt-3 space-y-1.5">
                {REPO.commits.map((c) => (
                  <li key={c.hash} className="group flex items-baseline gap-3 font-mono text-[12px]">
                    <span className="text-amber-600 group-hover:text-amber-400 transition-colors">{c.hash}</span>
                    <span className="text-mist-300 group-hover:text-paper-100 transition-colors">{c.msg}</span>
                    <span className="ml-auto shrink-0 text-[10.5px] text-mist-600">{c.when}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <div className="flex flex-col gap-4">
          <Reveal delay={200}>
            <DiffusionCanvas />
          </Reveal>
          <Reveal delay={320}>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border border-line bg-ink-900/70 px-4 py-3 font-mono text-[12px] text-mist-300">
              <span>
                <span className="text-aqua-300">forward</span> {"q(x_t|x_0) = 𝒩(√ᾱ_t·x_0, (1−ᾱ_t)I)"}
              </span>
              <span className="hidden h-4 w-px bg-line sm:block" />
              <span>
                <span className="text-amber-400">reverse</span> {"p_θ(x_{t−1}|x_t) — learned"}
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── table of contents rail ────────────────────────────────── */
function TocRail({ active, execBySection }: { active: string; execBySection: Record<string, string> }) {
  return (
    <nav className="sticky top-[76px]" aria-label="Notebook sections">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-mist-600">table of contents</p>
      <ul className="space-y-0.5 border-l border-line">
        {SECTIONS.map((s) => {
          const on = active === s.id;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={`-ml-px flex items-baseline gap-2.5 border-l-2 py-1.5 pl-3.5 pr-2 transition-all duration-200 ${
                  on ? "border-amber-400 bg-ink-900 text-paper-100" : "border-transparent text-mist-400 hover:border-aqua-600 hover:text-paper-200"
                }`}
              >
                <span className={`font-mono text-[10.5px] ${on ? "text-amber-400" : "text-mist-600"}`}>{s.num}</span>
                <span className="text-[13px] font-medium">{s.title}</span>
                <span className="ml-auto font-mono text-[9.5px] text-mist-600">{execBySection[s.id]}</span>
              </a>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 border border-line bg-ink-900/70 p-3.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist-600">kernel</p>
        <p className="mt-1.5 font-mono text-[11.5px] text-mist-300">Python 3.11 · torch 2.3.1</p>
        <p className="font-mono text-[11.5px] text-mist-300">1× A6000 · 17.8 GB peak</p>
      </div>
    </nav>
  );
}

/* ── section header ────────────────────────────────────────── */
function SectionHead({ num, title, blurb }: { num: string; title: string; blurb: string }) {
  return (
    <Reveal className="mb-6">
      <div className="flex items-baseline gap-4">
        <span className="font-display text-[44px] font-extrabold leading-none text-ink-700 transition-colors sm:text-[56px]">{num}</span>
        <div className="min-w-0">
          <h2 className="font-display text-[26px] font-bold leading-tight tracking-tight text-paper-50 sm:text-[30px]">{title}</h2>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-mist-400">{blurb}</p>
        </div>
      </div>
      <div className="mt-4 h-px w-full bg-gradient-to-r from-amber-600/70 via-line to-transparent" />
    </Reveal>
  );
}

/* ── repository footer panel ───────────────────────────────── */
function RepoSection() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    if (await copyText(text)) {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    }
  };
  const steps: { key: string; cmd: string; note: string }[] = [
    { key: "clone", cmd: REPO.clone, note: "grab the repo" },
    { key: "env", cmd: "pip install torch transformers datasets mauve-text", note: "four deps, that's all" },
    { key: "lab", cmd: "jupyter lab notebooks/diffusion_lm.ipynb", note: "run top to bottom" },
  ];
  return (
    <section className="border-t border-line bg-ink-900/50">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.25fr_1fr]">
        <Reveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-aqua-300">README.md</p>
          <h2 className="mt-3 font-display text-[34px] font-bold leading-tight tracking-tight text-paper-50 sm:text-[42px]">
            Run it on <span className="text-amber-400">your machine</span>
          </h2>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-mist-300">
            The notebook is deliberately monolithic — one file, no config sprawl, every shape annotated. Swap the toy LM1B loader for your corpus and the same
            pipeline trains; the checkpoint format is plain state-dicts.
          </p>
          <div className="mt-7 space-y-2.5">
            {steps.map((s, i) => (
              <div key={s.key} className="group flex items-center gap-3 border border-line bg-ink-950 px-4 py-3 transition-colors hover:border-aqua-600/60">
                <span className="font-mono text-[11px] text-mist-600">{i + 1}</span>
                <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-paper-200">{s.cmd}</code>
                <span className="hidden font-mono text-[10px] text-mist-600 md:block">{s.note}</span>
                <button
                  onClick={() => copy(s.key, s.cmd)}
                  className="btn-lab shrink-0 border border-line bg-ink-800 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-mist-300 hover:border-aqua-600 hover:text-aqua-300"
                >
                  {copied === s.key ? "✓" : "copy"}
                </button>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {["torch ≥ 2.1", "transformers", "datasets", "mauve-text", "jupyterlab", "python 3.11"].map((d) => (
              <span key={d} className="border border-line bg-ink-950 px-2.5 py-1 font-mono text-[11px] text-mist-300 transition-colors hover:border-aqua-600 hover:text-aqua-300">
                {d}
              </span>
            ))}
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div className="border border-line bg-ink-950">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="flex items-center gap-2.5 font-mono text-[13px] text-paper-100">
                <IconBook />
                {REPO.owner}/{REPO.name}
              </div>
              <span className="border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-mist-400">MIT</span>
            </div>
            <div className="grid grid-cols-2 gap-px bg-line">
              {[
                { icon: <IconStar />, k: "stars", v: REPO.stats.stars },
                { icon: <IconFork />, k: "forks", v: REPO.stats.forks },
                { icon: <IconBook />, k: "cells", v: REPO.stats.cells },
                { icon: <IconStar />, k: "steps", v: REPO.stats.steps },
              ].map((s) => (
                <div key={s.k} className="group flex items-center gap-3 bg-ink-950 px-5 py-4 transition-colors hover:bg-ink-900">
                  <span className="text-mist-600 group-hover:text-amber-400 transition-colors">{s.icon}</span>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-mist-600">{s.k}</span>
                  <span className="ml-auto font-display text-[19px] font-bold text-paper-100">{s.v}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2.5 border-t border-line p-5">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="btn-lab flex w-full items-center justify-center gap-2 border border-aqua-600 bg-aqua-900/60 px-4 py-2.5 font-mono text-[12px] font-semibold uppercase tracking-wider text-aqua-300 hover:bg-aqua-900"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
                  <path d="M7 .5a6.5 6.5 0 00-2.06 12.67c.33.06.45-.14.45-.31v-1.2c-1.8.39-2.18-.77-2.18-.77-.3-.75-.72-.95-.72-.95-.59-.4.04-.4.04-.4.65.05 1 .67 1 .67.58 1 1.52.71 1.9.54.05-.42.22-.71.41-.88-1.44-.16-2.95-.72-2.95-3.2 0-.71.25-1.29.67-1.74-.07-.17-.29-.83.06-1.73 0 0 .54-.17 1.78.66a6.2 6.2 0 013.24 0c1.23-.83 1.77-.66 1.77-.66.36.9.14 1.56.07 1.73.42.45.67 1.03.67 1.74 0 2.49-1.52 3.04-2.96 3.2.23.2.44.6.44 1.2v1.78c0 .17.11.37.45.3A6.5 6.5 0 007 .5z" />
                </svg>
                open on github
              </a>
              <button
                onClick={() => copy("clone2", REPO.clone)}
                className="btn-lab w-full border border-line bg-ink-900 px-4 py-2.5 font-mono text-[11px] text-mist-300 transition-colors hover:border-amber-600 hover:text-amber-300"
              >
                {copied === "clone2" ? "copied ✓" : "git clone …"}
              </button>
              <p className="pt-1 text-center font-mono text-[10px] text-mist-600">swap “{REPO.owner}” for your GitHub handle to wire this to your repo</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── app ───────────────────────────────────────────────────── */
export default function App() {
  const [states, setStates] = useState<States>(initialStates);
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState("setup");
  const [progress, setProgress] = useState(0);
  const counter = useRef(9);

  const runCell = useCallback((id: string) => {
    setStates((prev) => ({ ...prev, [id]: { ...prev[id], state: "running" } }));
    window.setTimeout(() => {
      counter.current += 1;
      const n = counter.current;
      setStates((prev) => ({ ...prev, [id]: { state: "done", count: n, replay: prev[id].replay + 1 } }));
    }, prefersReducedMotion() ? 60 : 750);
  }, []);

  const runAll = useCallback(async () => {
    if (running) return;
    setRunning(true);
    const codeCells = CELLS.filter((c) => c.kind === "code");
    for (const c of codeCells) {
      setStates((prev) => ({ ...prev, [c.id]: { ...prev[c.id], state: "running" } }));
      await sleep(620);
      counter.current += 1;
      const n = counter.current;
      setStates((prev) => ({ ...prev, [c.id]: { state: "done", count: n, replay: prev[c.id].replay + 1 } }));
    }
    setRunning(false);
  }, [running]);

  /* scroll-spy */
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  /* reading progress bar */
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? h.scrollTop / max : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const execBySection: Record<string, string> = {};
  for (const s of SECTIONS) {
    const counts = CELLS.filter((c) => c.section === s.id && c.kind === "code" && states[c.id].count).map((c) => states[c.id].count as number);
    execBySection[s.id] = counts.length ? counts.join(",") : "—";
  }

  return (
    <div id="top" className="bg-lab noise min-h-screen">
      {/* reading progress */}
      <div className="fixed left-0 top-0 z-[70] h-[2.5px] bg-amber-400 transition-[width] duration-150 ease-out" style={{ width: `${progress * 100}%` }} />

      <TopBar busy={running} onRunAll={runAll} running={running} />
      <Hero />

      {/* notebook body */}
      <main className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[240px_1fr] lg:gap-14">
          <aside className="hidden lg:block">
            <TocRail active={active} execBySection={execBySection} />
          </aside>

          {/* mobile toc chips */}
          <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`shrink-0 border px-3 py-1.5 font-mono text-[11px] transition-colors ${
                  active === s.id ? "border-amber-400 bg-amber-900/40 text-amber-300" : "border-line bg-ink-900 text-mist-400"
                }`}
              >
                {s.num} {s.title}
              </a>
            ))}
          </div>

          <div className="min-w-0 space-y-16">
            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <SectionHead num={s.num} title={s.title} blurb={s.blurb} />
                <div className="space-y-5">
                  {CELLS.filter((c) => c.section === s.id).map((c, i) => (
                    <Reveal key={c.id} delay={i * 90}>
                      <CellView cell={c} status={states[c.id]} onRun={runCell} />
                    </Reveal>
                  ))}
                  {s.id === "export" && (
                    <Reveal delay={120}>
                      <ExportPanel />
                    </Reveal>
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <RepoSection />

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-8 font-mono text-[11px] text-mist-600 sm:flex-row sm:items-center sm:px-6">
          <p>
            <span className="text-aqua-400">diffusion-lm</span> · typeset in Syne & IBM Plex · particles drawn live on canvas · nbformat 4.5
          </p>
          <a href="#top" className="btn-lab btn-top border border-line bg-ink-900 px-3 py-1.5 uppercase tracking-widest text-mist-400 hover:border-aqua-600 hover:text-aqua-300">
            ↑ x_T → back to top
          </a>
        </div>
      </footer>
    </div>
  );
}
