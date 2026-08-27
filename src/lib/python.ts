export type Token = { text: string; cls: string | null };

const KEYWORDS =
  "def|class|import|from|as|with|for|while|if|elif|else|return|yield|lambda|pass|raise|try|except|finally|in|is|not|and|or|assert|global|nonlocal|del|break|continue|async|await|print";
const BUILTINS =
  "self|cls|None|True|False|torch|nn|np|F|math|plt|tqdm|range|len|enumerate|zip|list|dict|set|tuple|sum|min|max|abs|open|super|isinstance|lambda|device|float|int|str";

const MASTER = new RegExp(
  [
    "(#[^\\n]*)", // 1 comment
    "(\"\"\"[\\s\\S]*?\"\"\"|\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*')", // 2 string
    "(@[A-Za-z_][\\w.]*)", // 3 decorator
    "(\\b\\d[\\d_]*(?:\\.\\d+)?(?:e[+-]?\\d+)?\\b)", // 4 number
    `(\\b(?:${KEYWORDS})\\b)`, // 5 keyword
    `(\\b(?:${BUILTINS})\\b)`, // 6 builtin
    "([A-Za-z_][\\w]*)(?=\\()", // 7 function call
  ].join("|"),
  "g",
);

const CLS = ["tk-com", "tk-str", "tk-dec", "tk-num", "tk-kw", "tk-bi", "tk-fn"];

export function tokenizePython(source: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  MASTER.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MASTER.exec(source)) !== null) {
    if (m.index > last) tokens.push({ text: source.slice(last, m.index), cls: null });
    let cls: string | null = null;
    for (let g = 1; g <= 7; g++) {
      if (m[g] !== undefined) {
        cls = CLS[g - 1];
        break;
      }
    }
    tokens.push({ text: m[0], cls });
    last = m.index + m[0].length;
  }
  if (last < source.length) tokens.push({ text: source.slice(last), cls: null });
  return tokens;
}
