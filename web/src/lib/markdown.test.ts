import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown } from "./markdown";

describe("parseMarkdown", () => {
  it("separa parágrafos, listas e títulos", () => {
    const blocks = parseMarkdown("**Resumo**: piora.\n\n- OD baixo\n- fósforo alto\n\n1. coletar\n2. fiscalizar\n## Próximos passos");
    expect(blocks.map((b) => b.kind)).toEqual(["p", "ul", "ol", "h"]);
    expect(blocks[1]).toEqual({ kind: "ul", items: [[{ kind: "text", text: "OD baixo" }], [{ kind: "text", text: "fósforo alto" }]] });
  });

  it("reconhece negrito e código sem interpretar HTML", () => {
    expect(parseInline("IQA **63** em `RIO-02` <b>")).toEqual([
      { kind: "text", text: "IQA " },
      { kind: "strong", text: "63" },
      { kind: "text", text: " em " },
      { kind: "code", text: "RIO-02" },
      { kind: "text", text: " <b>" },
    ]);
  });

  it("mantém quebras de linha dentro do parágrafo", () => {
    expect(parseMarkdown("linha 1\nlinha 2")).toEqual([
      { kind: "p", lines: [[{ kind: "text", text: "linha 1" }], [{ kind: "text", text: "linha 2" }]] },
    ]);
  });
});
