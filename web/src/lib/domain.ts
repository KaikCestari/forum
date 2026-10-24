import type { Alert, IqaClass, Overview, Series, Severity, Station, StationType, Trend } from "../api/types";
import { dayDiff, fmt, joinPt, lowerFirst, mean } from "./format";

export function iqaClass(v: number | null | undefined): IqaClass | null {
  if (v == null) return null;
  if (v >= 80) return "Ótima";
  if (v >= 52) return "Boa";
  if (v >= 37) return "Regular";
  if (v >= 20) return "Ruim";
  return "Péssima";
}

export const IQA_COLOR: Record<IqaClass, string> = {
  "Ótima": "var(--iqa-otima)",
  Boa: "var(--iqa-boa)",
  Regular: "var(--iqa-regular)",
  Ruim: "var(--iqa-ruim)",
  "Péssima": "var(--iqa-pessima)",
};

export const SEVERITY: Record<Severity, { label: string; color: string; rank: number }> = {
  critico: { label: "Crítico", color: "var(--sev-critico)", rank: 0 },
  alto: { label: "Alto", color: "var(--sev-alto)", rank: 1 },
  atencao: { label: "Atenção", color: "var(--sev-atencao)", rank: 2 },
  cronico: { label: "Recorrente", color: "var(--sev-cronico)", rank: 3 },
};

/** Tendências e situações recorrentes cobrem o período todo; o resto são episódios. */
export const isLongTerm = (a: Alert) => a.category === "tendencia" || a.severity === "cronico";

export interface StationPos {
  x: number;
  y: number;
  label: "top" | "bottom" | "right";
}

/** Posição de cada estação no esquema da bacia sintética (um mapa de metrô, não geografia exata). */
export const SCHEMA: Record<string, StationPos> = {
  "RIO-01": { x: 160, y: 236, label: "top" },
  "RIO-03": { x: 262, y: 96, label: "right" },
  "RIO-02": { x: 410, y: 256, label: "bottom" },
  "LAG-01": { x: 570, y: 196, label: "top" },
  "RES-01": { x: 740, y: 262, label: "top" },
  "EST-01": { x: 905, y: 300, label: "top" },
};

/** Traçado do rio principal no esquema (coordenadas do viewBox 1000×440). */
export const MAIN_RIVER: [number, number][] = [
  [14, 262], [90, 252], [160, 236], [250, 246], [330, 238], [410, 256], [490, 226],
  [570, 196], [655, 222], [740, 262], [800, 280], [860, 292], [905, 300], [1000, 312],
];

/** Altura do rio principal num ponto x (interpolação linear entre os vértices). */
export function riverY(x: number): number {
  for (let i = 1; i < MAIN_RIVER.length; i++) {
    const [x0, y0] = MAIN_RIVER[i - 1];
    const [x1, y1] = MAIN_RIVER[i];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return MAIN_RIVER[MAIN_RIVER.length - 1][1];
}

/**
 * Onde desenhar cada estação. A bacia sintética usa o esquema fixo; dados reais
 * (ou estações fora dele) são distribuídos ao longo do rio, de oeste para leste.
 */
export function stationLayout(stations: Station[], real = false): { schematic: boolean; pos: Record<string, StationPos> } {
  if (!real && stations.every((s) => SCHEMA[s.id])) return { schematic: true, pos: SCHEMA };
  const order = stations.toSorted((a, b) => (a.lon ?? 0) - (b.lon ?? 0) || a.id.localeCompare(b.id));
  const pos: Record<string, StationPos> = {};
  order.forEach((s, i) => {
    const x = Math.round(120 + (i + 0.5) * (760 / order.length));
    pos[s.id] = { x, y: Math.round(riverY(x)), label: i % 2 ? "bottom" : "top" };
  });
  return { schematic: false, pos };
}

/** Estações na ordem em que a água passa por elas. */
export function riverOrder(stations: Station[], real = false): Station[] {
  const { pos } = stationLayout(stations, real);
  return stations.toSorted((a, b) => pos[a.id].x - pos[b.id].x);
}

export const shortName = (name: string) => name.replace("Rio Claro — ", "");

/** Parâmetros na ordem em que aparecem na vista da estação. */
export const PARAM_ORDER = [
  "iqa", "do_mgl", "coliforms_nmp", "phosphorus_mgl", "nitrate_mgl",
  "turbidity_ntu", "ph", "temp_c", "conductivity_uscm",
] as const;

export const DIGITS: Record<string, number> = {
  iqa: 0, ph: 2, do_mgl: 1, temp_c: 1, turbidity_ntu: 1, conductivity_uscm: 0,
  nitrate_mgl: 2, phosphorus_mgl: 3, coliforms_nmp: 0, do_sat_pct: 0,
};

export interface Limit {
  lines: number[];
  isBad: (v: number) => boolean;
  text: string;
}

/** Limites da Resolução CONAMA 357/2005, os mesmos usados pelos alertas. */
export function limitFor(param: string, type: StationType): Limit | null {
  switch (param) {
    case "do_mgl":
      return { lines: [5], isBad: (v) => v < 5, text: "mínimo de 5 mg/L" };
    case "coliforms_nmp":
      return { lines: [1000], isBad: (v) => v > 1000, text: "máximo de 1.000 NMP/100mL" };
    case "nitrate_mgl":
      return { lines: [10], isBad: (v) => v > 10, text: "máximo de 10 mg/L" };
    case "turbidity_ntu":
      return { lines: [100], isBad: (v) => v > 100, text: "máximo de 100 NTU" };
    case "phosphorus_mgl": {
      const l = type === "lago" || type === "reservatorio" ? 0.03 : type === "estuario" ? 0.124 : 0.1;
      return { lines: [l], isBad: (v) => v > l, text: `máximo de ${fmt(l, 3)} mg/L` };
    }
    case "ph": {
      const [lo, hi] = type === "estuario" ? [6.5, 8.5] : [6, 9];
      return { lines: [lo, hi], isBad: (v) => v < lo || v > hi, text: `entre ${fmt(lo, 1)} e ${fmt(hi, 1)}` };
    }
    default:
      return null;
  }
}

export function lastDays(values: (number | null)[], days = 30) {
  return values.slice(-days);
}

/** Quantos dos últimos `days` dias ficaram fora do limite. */
export function daysOutside(values: (number | null)[], limit: Limit | null, days = 30): number {
  if (!limit) return 0;
  return lastDays(values, days).filter((v) => v != null && limit.isBad(v)).length;
}

/** Resumo de uma estação em linguagem simples, para o topo da vista. */
export function stationSummary(station: Station, series: Series, parameters: Overview["parameters"]): string {
  const parts: string[] = [];
  const delta = station.iqa_30d - station.iqa_period;
  const comparison =
    Math.abs(delta) < 1.5
      ? `em linha com a média de ${fmt(station.iqa_period)} dos dois anos`
      : `${delta > 0 ? "acima" : "abaixo"} da média de ${fmt(station.iqa_period)} dos dois anos`;
  parts.push(`IQA médio de ${fmt(station.iqa_30d)} no último mês, ${comparison}.`);

  const outside = PARAM_ORDER.map((p) => ({ p, n: daysOutside(series[p] ?? [], limitFor(p, station.type)) }))
    .filter((o) => o.n > 0)
    .sort((a, b) => b.n - a.n);
  if (outside.length) {
    const [first, ...rest] = outside;
    const others = rest.map((o) => lowerFirst(parameters[o.p].label));
    parts.push(
      `${parameters[first.p].label} fora do limite em ${first.n} dos últimos 30 dias` +
        (others.length ? `, assim como ${joinPt(others)}.` : "."),
    );
  } else {
    parts.push("Todas as medidas ficaram dentro dos limites legais (CONAMA) no último mês.");
  }
  if (station.worsening_trends.length) {
    parts.push(`Piora contínua em ${joinPt(station.worsening_trends.map(lowerFirst))}.`);
  }
  return parts.join(" ");
}

/** Frase principal da vista da bacia. */
export function basinHeadline(stations: Station[]): string {
  const good = stations.filter((s) => {
    const c = iqaClass(s.iqa_30d);
    return c === "Ótima" || c === "Boa";
  }).length;
  if (stations.length === 1 && good === 1) return "Estação com água boa ou ótima";
  if (good === stations.length) return `As ${stations.length} estações com água boa ou ótima`;
  if (good === 0) return "Nenhuma estação com água boa";
  return `${good} de ${stations.length} estações com água boa ou ótima`;
}

export function basinLede(data: Overview): string {
  const worst = data.stations.reduce((a, b) => (b.iqa_30d < a.iqa_30d ? b : a));
  const end = data.period[1];
  const recentCritical = data.alerts.filter((a) => a.severity === "critico" && dayDiff(a.end, end) <= 90).length;
  const worsening = data.stations.filter((s) => s.worsening_trends.length).map((s) => s.name);
  const critical = recentCritical
    ? `há ${recentCritical} ${recentCritical === 1 ? "alerta crítico" : "alertas críticos"} nos últimos 90 dias`
    : "não há alertas críticos nos últimos 90 dias";
  const trend = worsening.length
    ? ` ${joinPt(worsening)} ${worsening.length === 1 ? "piora" : "pioram"} ano a ano.`
    : "";
  return `O trecho mais pressionado é ${worst.name}, com IQA ${fmt(worst.iqa_30d)}, e ${critical}.${trend}`;
}

export function hadRecentCritical(data: Overview, stationId: string, days = 90): boolean {
  return data.alerts.some(
    (a) => a.station_id === stationId && a.severity === "critico" && dayDiff(a.end, data.period[1]) <= days,
  );
}

export function trendTone(t: Trend): string {
  if (t.verdict === "piora") return "var(--bad-ink)";
  if (t.verdict === "melhora") return "var(--good-ink)";
  return "var(--ink-2)";
}

export function verdictLabel(t: Trend): string {
  return { piora: "Piora", melhora: "Melhora", "alteração": "Alteração", "estável": "Estável" }[t.verdict];
}

/** Médias por blocos de `size` dias, para sparklines leves. */
export function bucketMeans(values: (number | null)[], size: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i += size) out.push(mean(values.slice(i, i + size)));
  return out;
}
