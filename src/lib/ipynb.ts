import type { Cell } from "../data/notebook";

/** Build a valid nbformat-4 notebook document from the site's cell data. */
export function buildNotebook(cells: Cell[]): Record<string, unknown> {
  const toSource = (s: string) => s.split("\n").map((l, i, arr) => (i < arr.length - 1 ? l + "\n" : l));
  return {
    cells: cells.map((c) => ({
      cell_type: c.kind,
      metadata: {},
      source: toSource(c.source.trim()),
      ...(c.kind === "code" ? { execution_count: null, outputs: [] } : {}),
    })),
    metadata: {
      kernelspec: { display_name: "Python 3 (ipykernel)", language: "python", name: "python3" },
      language_info: { name: "python", version: "3.11.9", codemirror_mode: { name: "ipython", version: 3 } },
    },
    nbformat: 4,
    nbformat_minor: 5,
  };
}

export function downloadNotebook(cells: Cell[], filename = "diffusion_lm.ipynb") {
  const blob = new Blob([JSON.stringify(buildNotebook(cells), null, 1)], { type: "application/x-ipynb+json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}
