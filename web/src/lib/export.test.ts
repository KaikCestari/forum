import { describe, expect, it } from "vitest";
import type { Series, Station } from "../api/types";
import { csvCell, csvLine, seriesToCsv, slug } from "./export";

describe("csv", () => {
  it("usa vírgula decimal e protege separadores e aspas", () => {
    expect(csvCell(7.25)).toBe("7,25");
    expect(csvCell(null)).toBe("");
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvLine(["x", 1.5, null])).toBe("x;1,5;");
  });

  it("monta a série da estação com cabeçalho legível", () => {
    const station = { id: "RIO-01", name: "Rio Claro, nascente" } as Station;
    const series = {
      dates: ["2025-01-01", "2025-01-02"],
      iqa_class: ["Boa", ""],
      anomaly: [false, true],
      iqa: [70.12345, null],
      ph: [7.2, 7.3],
    } as unknown as Series;
    const parameters = { iqa: { label: "IQA", unit: "" }, ph: { label: "pH", unit: "" } };
    const lines = seriesToCsv(station, series, parameters).split("\r\n");
    expect(lines[0]).toBe("Estação: Rio Claro, nascente");
    expect(lines[1].startsWith("data;IQA;")).toBe(true);
    expect(lines[2].startsWith("2025-01-01;70,123;")).toBe(true);
    expect(lines[2].endsWith(";Boa;não")).toBe(true);
    expect(lines[3].endsWith(";;sim")).toBe(true);
  });

  it("gera nomes de arquivo sem acento", () => {
    expect(slug("Rio Claro — Jusante urbana")).toBe("rio-claro-jusante-urbana");
  });
});
