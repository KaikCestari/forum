// Markdown mínimo das respostas do Llama: parágrafos, listas, títulos, negrito
// e código. Vira uma árvore simples que o React desenha, sem innerHTML.

export type Inline = { kind: "text" | "strong" | "code"; text: string };
export type Block =
  | { kind: "p"; lines: Inline[][] }
  | { kind: "ul" | "ol"; items: Inline[][] }
  | { kind: "h"; text: Inline[] };

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let last = 0;
  for (const m of s.matchAll(re)) {
    if (m.index > last) out.push({ kind: "text", text: s.slice(last, m.index) });
    out.push(m[1] != null ? { kind: "strong", text: m[1] } : { kind: "code", text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ kind: "text", text: s.slice(last) });
  return out;
}

export function parseMarkdown(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  // A asserção evita que o TypeScript estreite para null: a lista muda dentro dos closures.
  let list = null as { kind: "ul" | "ol"; items: string[] } | null;

  const flushPara = () => {
    if (para.length) blocks.push({ kind: "p", lines: para.map(parseInline) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ kind: list.kind, items: list.items.map(parseInline) });
    list = null;
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const ul = line.match(/^[-*•]\s+(.*)/);
    const ol = line.match(/^\d+[.)]\s+(.*)/);
    const h = line.match(/^#{1,6}\s+(.*)/);
    if (!line) {
      flushPara();
      flushList();
    } else if (h) {
      flushPara();
      flushList();
      blocks.push({ kind: "h", text: parseInline(h[1]) });
    } else if (ul || ol) {
      flushPara();
      const kind = ul ? "ul" : "ol";
      if (list?.kind !== kind) {
        flushList();
        list = { kind, items: [] };
      }
      list!.items.push((ul ?? ol)![1]);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}
