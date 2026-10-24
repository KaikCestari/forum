import type { Series, Station } from "../api/types";
import { PARAM_ORDER } from "./domain";

const SEP = ";";

/** Valor de CSV no padrão brasileiro: vírgula decimal e aspas só quando preciso. */
export function csvCell(v: string | number | boolean | null | undefined): string {
  if (v == null) return "";
  const s = typeof v === "number" ? String(v).replace(".", ",") : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const csvLine = (cells: (string | number | boolean | null | undefined)[]) => cells.map(csvCell).join(SEP);

/** Série diária de uma estação, pronta para abrir no Excel (; e vírgula decimal). */
export function seriesToCsv(station: Station, series: Series, parameters: Record<string, { label: string; unit: string }>): string {
  const head = ["data", ...PARAM_ORDER.map((p) => `${parameters[p]?.label ?? p}${parameters[p]?.unit ? ` (${parameters[p].unit})` : ""}`), "classe do IQA", "dia fora do padrão"];
  const rows = series.dates.map((d, i) => [
    d,
    ...PARAM_ORDER.map((p) => {
      const v = series[p]?.[i];
      return v == null ? null : Math.round(v * 1000) / 1000;
    }),
    series.iqa_class[i] || null,
    series.anomaly[i] ? "sim" : "não",
  ]);
  return [csvLine([`Estação: ${station.name}`]), csvLine(head), ...rows.map(csvLine)].join("\r\n");
}

/** Planilhas de exemplo no formato que a importação entende. */
export const READINGS_TEMPLATE = [
  "timestamp;station_id;ph;do_mgl;temp_c;turbidity_ntu;conductivity_uscm;nitrate_mgl;phosphorus_mgl;coliforms_nmp",
  "01/01/2025 00:00;RIO-01;7,2;8,4;22,5;4,1;110;0,35;0,020;120",
  "01/01/2025 01:00;RIO-01;7,2;8,3;22,4;4,0;111;0,35;0,020;118",
  "01/01/2025 00:00;RIO-02;7,0;6,1;24,0;9,5;180;0,90;0,060;900",
].join("\r\n");

export const STATIONS_TEMPLATE = [
  "id;name;type;lat;lon",
  "RIO-01;Rio Claro, nascente;rio;-22,95;-47,10",
  "RIO-02;Rio Claro, jusante urbana;rio;-22,90;-47,05",
].join("\r\n");

/** Baixa um texto como arquivo. O BOM faz o Excel reconhecer os acentos. */
export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["﻿", text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Nome de arquivo seguro a partir de um título. */
export const slug = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
