import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const s = m[0];
    if (s.startsWith("**")) {
      out.push(
        <strong key={k++} className="font-semibold text-inktext">
          {s.slice(2, -2)}
        </strong>,
      );
    } else {
      out.push(
        <code key={k++} className="rounded-sm bg-inktext/10 px-1.5 py-0.5 font-mono text-[0.86em] text-[#0e5a50]">
          {s.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + s.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Markdown({ source }: { source: string }) {
  const lines = source.trim().split("\n");
  const nodes: ReactNode[] = [];
  let key = 0;
  let listBuf: string[] = [];

  const flushList = () => {
    if (!listBuf.length) return;
    nodes.push(
      <ul key={key++} className="space-y-1.5 pl-1">
        {listBuf.map((li, i) => (
          <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-inktext-soft">
            <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rotate-45 bg-amber-600" />
            <span>{inline(li)}</span>
          </li>
        ))}
      </ul>,
    );
    listBuf = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      continue;
    }
    if (line.startsWith("$$")) {
      flushList();
      nodes.push(
        <div key={key++} className="formula-block overflow-x-auto px-4 py-3 text-[13.5px] leading-relaxed text-inktext">
          {line.replace(/^\$\$\s*/, "").replace(/\s*\$\$$/, "")}
        </div>,
      );
      continue;
    }
    if (line.startsWith("### ")) {
      flushList();
      nodes.push(
        <h3 key={key++} className="font-display text-[22px] font-bold tracking-tight text-inktext">
          {inline(line.slice(4))}
        </h3>,
      );
      continue;
    }
    if (line.startsWith("> ")) {
      flushList();
      nodes.push(
        <blockquote key={key++} className="border-l-[3px] border-aqua-600 bg-aqua-900/10 px-4 py-2.5 text-[14px] italic leading-relaxed text-inktext-soft">
          {inline(line.slice(2))}
        </blockquote>,
      );
      continue;
    }
    if (line.startsWith("- ")) {
      listBuf.push(line.slice(2));
      continue;
    }
    flushList();
    nodes.push(
      <p key={key++} className="text-[15px] leading-relaxed text-inktext-soft">
        {inline(line)}
      </p>,
    );
  }
  flushList();

  return <div className="space-y-4">{nodes}</div>;
}
