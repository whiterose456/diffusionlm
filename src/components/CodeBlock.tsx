import { useMemo } from "react";
import { tokenizePython } from "../lib/python";

export default function CodeBlock({ source }: { source: string }) {
  const lines = useMemo(() => {
    const tokens = tokenizePython(source.trim());
    const rows: { text: string; cls: string | null }[][] = [[]];
    for (const tk of tokens) {
      const parts = tk.text.split("\n");
      parts.forEach((part, i) => {
        if (i > 0) rows.push([]);
        if (part.length) rows[rows.length - 1].push({ text: part, cls: tk.cls });
      });
    }
    return rows;
  }, [source]);

  return (
    <div className="overflow-x-auto py-3 pr-4 font-mono text-[12.5px] leading-[1.75]">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((row, i) => (
            <tr key={i} className="group align-top">
              <td className="w-10 select-none pr-3 text-right text-[11px] leading-[1.9] text-mist-600/70 group-hover:text-aqua-600">
                {i + 1}
              </td>
              <td className="whitespace-pre text-paper-200">
                {row.length === 0 ? "\u00A0" : row.map((tk, j) => (tk.cls ? <span key={j} className={tk.cls}>{tk.text}</span> : tk.text))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
