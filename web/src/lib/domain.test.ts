import { describe, expect, it } from "vitest";
import type { Series, Station } from "../api/types";
import { basinHeadline, daysOutside, iqaClass, limitFor, riverOrder, stationLayout, stationSummary } from "./domain";
import { dateRange, fmt, joinPt, periodLength } from "./format";

const station = (over: Partial<Station>): Station => ({
  id: "RIO-02", name: "Rio Claro — Jusante urbana", type: "rio", lat: 0, lon: 0,
  latest: { date: "2026-09-30", iqa: 63, iqa_class: "Boa" },
  iqa_30d: 63, iqa_period: 61, predicted: null, cluster: 2, cluster_label: "Impactado",
  worsening_trends: [], alerts_total: 0, alerts_recent: 0, critical_total: 0, ...over,
});

describe("iqaClass", () => {
  it("segue as faixas da CETESB", () => {
    expect(iqaClass(80)).toBe("Ótima");
    expect(iqaClass(79.9)).toBe("Boa");
    expect(iqaClass(52)).toBe("Boa");
    expect(iqaClass(37)).toBe("Regular");
    expect(iqaClass(20)).toBe("Ruim");
    expect(iqaClass(19)).toBe("Péssima");
    expect(iqaClass(null)).toBeNull();
  });
});

describe("limitFor", () => {
  it("usa o limite de fósforo do tipo de ambiente", () => {
    expect(limitFor("phosphorus_mgl", "rio")?.lines).toEqual([0.1]);
    expect(limitFor("phosphorus_mgl", "lago")?.lines).toEqual([0.03]);
    expect(limitFor("phosphorus_mgl", "estuario")?.lines).toEqual([0.124]);
  });

  it("trata pH como faixa e oxigênio como mínimo", () => {
    const ph = limitFor("ph", "rio")!;
    expect(ph.isBad(5.9)).toBe(true);
    expect(ph.isBad(7)).toBe(false);
    expect(limitFor("ph", "estuario")!.isBad(8.7)).toBe(true);
    expect(limitFor("do_mgl", "rio")!.isBad(4.9)).toBe(true);
  });

  it("não inventa limite para temperatura", () => {
    expect(limitFor("temp_c", "rio")).toBeNull();
  });
});

describe("daysOutside", () => {
  it("conta apenas os últimos 30 dias e ignora falhas", () => {
    const values = [...Array(40).fill(2000), ...Array(25).fill(500), null, 3000, 3000, null, 10];
    expect(daysOutside(values, limitFor("coliforms_nmp", "rio"))).toBe(2);
  });
});

describe("stationSummary", () => {
  const parameters = { coliforms_nmp: { label: "Coliformes", unit: "" }, phosphorus_mgl: { label: "Fósforo total", unit: "" } };

  it("cita o parâmetro mais violado primeiro e as tendências", () => {
    const series = {
      dates: [], iqa_class: [], anomaly: [],
      coliforms_nmp: Array(30).fill(3000),
      phosphorus_mgl: [...Array(20).fill(0.05), ...Array(10).fill(0.3)],
    } as unknown as Series;
    const text = stationSummary(station({ worsening_trends: ["Nitrato"] }), series, parameters as never);
    expect(text).toContain("acima da média de 61");
    expect(text).toContain("Coliformes fora do limite em 30 dos últimos 30 dias, assim como fósforo total.");
    expect(text).toContain("Piora contínua em nitrato.");
  });

  it("diz quando tudo está dentro dos limites", () => {
    const series = { dates: [], iqa_class: [], anomaly: [] } as unknown as Series;
    expect(stationSummary(station({ iqa_30d: 61.5 }), series, parameters as never)).toContain(
      "em linha com a média",
    );
  });
});

describe("textos", () => {
  it("monta a manchete da bacia", () => {
    expect(basinHeadline([station({}), station({ iqa_30d: 30 })])).toBe("1 de 2 estações com água boa ou ótima");
  });

  it("ordena as estações rio abaixo", () => {
    const order = riverOrder([station({ id: "EST-01" }), station({ id: "RIO-01" }), station({ id: "LAG-01" })]);
    expect(order.map((s) => s.id)).toEqual(["RIO-01", "LAG-01", "EST-01"]);
  });

  it("formata em português", () => {
    expect(fmt(105120)).toBe("105.120");
    expect(fmt(0.24, 3)).toBe("0,240");
    expect(joinPt(["a", "b", "c"])).toBe("a, b e c");
    expect(dateRange("2026-07-12", "2026-07-14")).toBe("12 a 14/07/2026");
  });
});

describe("stationLayout", () => {
  it("usa o esquema fixo só para a bacia sintética", () => {
    const synthetic = [station({ id: "RIO-01" }), station({ id: "LAG-01" })];
    expect(stationLayout(synthetic).schematic).toBe(true);
    expect(stationLayout(synthetic, true).schematic).toBe(false);
  });

  it("distribui estações reais de oeste para leste ao longo do rio", () => {
    const real = [station({ id: "B", lon: -46.7 }), station({ id: "A", lon: -47.1 }), station({ id: "C", lon: null })];
    const { schematic, pos } = stationLayout(real, true);
    expect(schematic).toBe(false);
    expect(pos.A.x).toBeLessThan(pos.B.x);
    expect(pos.B.x).toBeLessThan(pos.C.x);
    expect(riverOrder(real, true).map((s) => s.id)).toEqual(["A", "B", "C"]);
  });
});

describe("periodLength", () => {
  it("descreve o período em anos ou meses", () => {
    expect(periodLength("2024-10-01", "2026-09-30")).toBe("Dois anos");
    expect(periodLength("2025-06-01", "2026-09-30")).toBe("16 meses");
    expect(periodLength("2025-01-01", "2025-12-31")).toBe("Um ano");
    expect(periodLength("2025-03-01", "2025-03-20")).toBe("Um mês");
  });
});
