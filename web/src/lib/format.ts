const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const formatters = new Map<number, Intl.NumberFormat>();

export function fmt(v: number | null | undefined, digits = 0): string {
  if (v == null || Number.isNaN(v)) return "—";
  let f = formatters.get(digits);
  if (!f) {
    f = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    formatters.set(digits, f);
  }
  return f.format(v);
}

/** 2026-07-12 → 12/07/2026 */
export const dmy = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/** 2026-07-12 → 12 jul */
export const dayMonth = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
};

/** 2026-07 (ou 2026-07-12) → jul/26 */
export const monthLabel = (iso: string) => {
  const [y, m] = iso.split("-");
  return `${MONTHS[Number(m) - 1]}/${y.slice(2)}`;
};

/** Intervalo legível: "12 a 14/07/2026" ou "12/07/2026". */
export function dateRange(start: string, end: string): string {
  if (start === end) return dmy(start);
  const [y1, m1, d1] = start.split("-");
  const [y2, m2] = end.split("-");
  if (y1 === y2 && m1 === m2) return `${Number(d1)} a ${dmy(end)}`;
  return `${dmy(start)} a ${dmy(end)}`;
}

export const toTime = (iso: string) => new Date(`${iso}T00:00:00`).getTime();
export const dayDiff = (a: string, b: string) => Math.round((toTime(b) - toTime(a)) / 86_400_000);

export const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** ["a","b","c"] → "a, b e c" */
export function joinPt(items: string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

export function plural(n: number, one: string, many: string): string {
  return `${fmt(n)} ${n === 1 ? one : many}`;
}

export function mean(values: (number | null)[]): number | null {
  let sum = 0;
  let n = 0;
  for (const v of values) {
    if (v != null) {
      sum += v;
      n++;
    }
  }
  return n ? sum / n : null;
}
