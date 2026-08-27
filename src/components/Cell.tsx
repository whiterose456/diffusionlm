import type { Cell as CellData } from "../data/notebook";
import Markdown from "./Markdown";
import CodeBlock from "./CodeBlock";
import { ScheduleChart, LossChart, EmbeddingScatter, EvalBars, ArchDiagram } from "./charts";
import { TextDiffusion, GuidanceWidget, ExportPanel, StdOut } from "./widgets";

export type CellStatus = { state: "idle" | "running" | "done"; count: number | null; replay: number };

function Output({ kind, replay }: { kind: NonNullable<CellData["output"]>; replay: number }) {
  const inner = (() => {
    switch (kind) {
      case "versions":
        return (
          <StdOut
            lines={[
              "torch 2.3.1+cu121 · device cuda:0 · cuda True",
              "transformers 4.41.2 · datasets 2.19.1 · numpy 1.26.4",
              "seed 0 locked — replay this notebook and get the same run",
            ]}
          />
        );
      case "schedule":
        return <ScheduleChart />;
      case "scatter":
        return <EmbeddingScatter />;
      case "arch":
        return (
          <div>
            <ArchDiagram />
            <StdOut lines={["denoiser ready · 38.4M params"]} />
          </div>
        );
      case "loss":
        return (
          <div>
            <LossChart animateKey={replay} />
            <StdOut lines={["step 400000 · loss 0.0412 · val 0.0431 · lr 3.1e-06", "checkpoint saved → ckpt/diffusion_lm_400k.pt"]} />
          </div>
        );
      case "sample":
        return <TextDiffusion />;
      case "cfg":
        return <GuidanceWidget />;
      case "eval":
        return (
          <div>
            <EvalBars />
            <StdOut lines={['{"ppl": 29.6, "mauve": 0.91, "dist2": 0.77}']} />
          </div>
        );
      default:
        return null;
    }
  })();
  if (!inner) return null;
  return (
    <div key={replay} className="output-in space-y-2 border-t border-line-soft px-3 py-3 sm:px-4">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-mist-600">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path d="M1 5h2.2l1.4-3 1.8 6 1.4-3H9" stroke="#45d0be" strokeWidth="1.2" />
        </svg>
        Out[{replay > 0 ? replay : "·"}]
      </div>
      {inner}
    </div>
  );
}

export default function Cell({
  cell,
  status,
  onRun,
}: {
  cell: CellData;
  status: CellStatus;
  onRun: (id: string) => void;
}) {
  if (cell.kind === "markdown") {
    return (
      <article className="paper-cell relative border border-paper-300/60 px-5 py-6 sm:px-8 sm:py-7">
        <span className="absolute right-4 top-4 font-mono text-[10px] uppercase tracking-[0.2em] text-inktext-soft/50">md</span>
        <Markdown source={cell.source} />
      </article>
    );
  }

  const badge =
    status.state === "running" ? (
      <span className="flex items-center gap-1.5 font-mono text-[11.5px] text-amber-300">
        <svg className="spin" width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
          <circle cx="5.5" cy="5.5" r="4.4" stroke="#f0a63a" strokeWidth="1.6" strokeDasharray="18 10" />
        </svg>
        [*]
      </span>
    ) : (
      <span className={`font-mono text-[11.5px] ${status.count ? "text-aqua-300" : "text-mist-600"}`}>
        [{status.count ?? " "}]
      </span>
    );

  return (
    <article
      className={`relative border bg-ink-900 transition-colors duration-300 ${
        status.state === "running" ? "border-amber-600/70" : "border-line hover:border-aqua-600/50"
      }`}
    >
      <div className="flex items-center gap-3 border-b border-line-soft py-2 pl-3 pr-2 sm:pl-4">
        {badge}
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist-600">py · 3.11</span>
        <div className="ml-auto flex items-center gap-1.5">
          {status.state === "running" ? null : (
            <button
              onClick={() => onRun(cell.id)}
              className="btn-lab btn-run flex items-center gap-1.5 border border-line bg-ink-800 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-wider text-mist-300 hover:border-aqua-600 hover:text-aqua-300"
              aria-label="Run cell"
            >
              <svg width="9" height="10" viewBox="0 0 9 10" fill="currentColor" aria-hidden>
                <path d="M0.7 0.5l7.6 4.5-7.6 4.5z" />
              </svg>
              run
            </button>
          )}
        </div>
      </div>
      <CodeBlock source={cell.source} />
      {cell.output && <Output kind={cell.output} replay={status.replay} />}
    </article>
  );
}
