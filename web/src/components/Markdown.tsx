import { Fragment } from "react";
import { parseMarkdown, type Inline } from "../lib/markdown";

function Inlines({ parts }: { parts: Inline[] }) {
  return parts.map((p, i) =>
    p.kind === "strong" ? <strong key={i}>{p.text}</strong> : p.kind === "code" ? <code key={i}>{p.text}</code> : <Fragment key={i}>{p.text}</Fragment>,
  );
}

/** Desenha a resposta do Llama como texto formatado. */
export function Markdown({ text }: { text: string }) {
  return parseMarkdown(text).map((b, i) => {
    if (b.kind === "h") return <h4 key={i}><Inlines parts={b.text} /></h4>;
    if (b.kind === "p") {
      return (
        <p key={i}>
          {b.lines.map((line, j) => <Fragment key={j}>{j > 0 && <br />}<Inlines parts={line} /></Fragment>)}
        </p>
      );
    }
    const List = b.kind;
    return <List key={i}>{b.items.map((it, j) => <li key={j}><Inlines parts={it} /></li>)}</List>;
  });
}
