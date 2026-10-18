import { AnimatePresence, m, useReducedMotion, useSpring } from "motion/react";
import { scaleLinear, scaleLog } from "d3-scale";
import { curveMonotoneX, line } from "d3-shape";
import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { dmy, fmt, monthLabel, dayMonth } from "../lib/format";
import { useElementWidth } from "../lib/useElementWidth";
import { ease, spring } from "../motion/tokens";

export interface Band {
  from: string;
  to: string;
  label?: string;
  kind: "event" | "focus";
}

interface Props {
  /** Muda quando estação, parâmetro ou período mudam: redesenha a linha. */
  drawKey: string;
  dates: string[];
  daily: (number | null)[];
  smooth: (number | null)[];
  anomalies: boolean[];
  classes: string[];
  limits: number[];
  bands: Band[];
  log: boolean;
  unit: string;
  digits: number;
  label: string;
}

const M = { top: 30, right: 12, bottom: 30, left: 52 };
const HEIGHT = 380;

export function LineChart(props: Props) {
  const { drawKey, dates, daily, smooth, anomalies, classes, limits, bands, log, unit, digits, label } = props;
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const crossX = useSpring(0, spring.follow);
  const n = dates.length;

  const geo = useMemo(() => {
    if (!width || n < 2) return null;
    const x = scaleLinear().domain([0, n - 1]).range([M.left, width - M.right]);
    let lo = Infinity;
    let hi = -Infinity;
    for (const arr of [daily, smooth]) {
      for (const v of arr) {
        if (v == null || (log && v <= 0)) continue;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    for (const l of limits) {
      lo = Math.min(lo, l);
      hi = Math.max(hi, l);
    }
    if (!Number.isFinite(lo)) {
      lo = 0;
      hi = 1;
    }
    const y = log
      ? scaleLog().domain([Math.max(lo * 0.8, 1e-3), hi * 1.25]).range([HEIGHT - M.bottom, M.top]).nice()
      : scaleLinear().domain([lo - (hi - lo) * 0.06, hi + (hi - lo) * 0.06]).range([HEIGHT - M.bottom, M.top]).nice();

    const gen = line<number | null>()
      .defined((v) => v != null && (!log || v > 0))
      .x((_, i) => x(i))
      .y((v) => y(v as number));
    const dailyPath = gen(daily) ?? "";
    const smoothPath = gen.curve(curveMonotoneX)(smooth) ?? "";

    const yTicks = y.ticks(log ? 4 : 5).filter((t, i, arr) => !log || i === 0 || i === arr.length - 1 || Math.log10(t) % 1 === 0);
    const monthStarts = dates.map((d, i) => (d.endsWith("-01") ? i : -1)).filter((i) => i >= 0);
    const stride = Math.ceil(monthStarts.length / Math.max(2, Math.floor(width / 110)));
    const xTicks = n <= 100
      ? Array.from({ length: Math.min(7, n) }, (_, k) => Math.round((k * (n - 1)) / Math.max(1, Math.min(7, n) - 1)))
      : monthStarts.filter((_, k) => k % stride === 0);

    const index = new Map(dates.map((d, i) => [d, i]));
    const bandRects = bands
      .map((b) => {
        const a = index.get(b.from) ?? (b.from < dates[0] ? 0 : null);
        const z = index.get(b.to) ?? (b.to > dates[n - 1] ? n - 1 : null);
        if (a == null || z == null || b.to < dates[0] || b.from > dates[n - 1]) return null;
        const x0 = x(a) - 3;
        return { ...b, x0, w: Math.max(4, x(z) - x(a) + 6) };
      })
      .filter((b): b is NonNullable<typeof b> => b != null);

    return { x, y, dailyPath, smoothPath, yTicks, xTicks, bandRects };
  }, [width, n, daily, smooth, limits, log, dates, bands]);

  const anomalyIdx = useMemo(() => anomalies.flatMap((a, i) => (a && daily[i] != null ? [i] : [])), [anomalies, daily]);

  if (!geo) return <div ref={ref} className="line-chart" style={{ height: HEIGHT }} />;
  const { x, y, dailyPath, smoothPath, yTicks, xTicks, bandRects } = geo;

  const moveTo = (i: number) => {
    const clamped = Math.max(0, Math.min(n - 1, i));
    setHover(clamped);
    crossX.set(x(clamped));
  };
  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const idx = Math.round(x.invert(e.clientX - rect.left));
    if (hover == null) crossX.jump(x(Math.max(0, Math.min(n - 1, idx))));
    moveTo(idx);
  };
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 7 : 1;
    if (e.key === "ArrowRight") moveTo((hover ?? n - 1) + step);
    else if (e.key === "ArrowLeft") moveTo((hover ?? n - 1) - step);
    else if (e.key === "Escape") setHover(null);
    else return;
    e.preventDefault();
  };

  const hv = hover != null ? daily[hover] : null;
  const hs = hover != null ? smooth[hover] : null;
  const hy = hs ?? hv;
  const tipLeft = hover != null && x(hover) > width * 0.62;
  const drawTransition = reduce ? { duration: 0 } : { duration: 1.15, ease: ease.inOut };

  return (
    <div ref={ref} className="line-chart">
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label={`${label}: ${n} dias, de ${dmy(dates[0])} a ${dmy(dates[n - 1])}. Use as setas para percorrer os dias.`}
        tabIndex={0}
        onPointerMove={onPointer}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        <AnimatePresence>
          {bandRects.map((b) => (
            <m.g key={`${drawKey}-${b.from}-${b.kind}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
              <rect x={b.x0} y={M.top} width={b.w} height={HEIGHT - M.top - M.bottom} className={`band band-${b.kind}`} />
              {b.label && (
                <text x={Math.min(b.x0 + 6, width - M.right - 6)} y={M.top - 10} className="band-label" textAnchor={b.x0 > width * 0.7 ? "end" : "start"}>
                  {b.label}
                </text>
              )}
            </m.g>
          ))}
        </AnimatePresence>

        {yTicks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} className="grid" />
            <text x={M.left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="axis">
              {fmt(t, t < 1 ? 2 : 0)}
            </text>
          </g>
        ))}
        {xTicks.map((i) => (
          <text key={i} x={x(i)} y={HEIGHT - 8} textAnchor="middle" className="axis">
            {n > 100 ? monthLabel(dates[i]) : dayMonth(dates[i])}
          </text>
        ))}

        {limits.map((l) => (
          <m.line
            key={`${drawKey}-limit-${l}`}
            x1={M.left} x2={width - M.right} y1={y(l)} y2={y(l)} className="limit"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease: ease.out, delay: 0.2 }}
          />
        ))}

        <m.path key={`${drawKey}-daily`} d={dailyPath} className="line-daily" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={drawTransition} />
        <m.path key={`${drawKey}-smooth`} d={smoothPath} className="line-smooth" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={drawTransition} />

        {anomalyIdx.map((i, k) => {
          const cx = x(i);
          const cy = y(daily[i] as number);
          return (
            <m.path
              key={`${drawKey}-a-${i}`}
              d={`M${cx},${cy - 7} L${cx + 6.5},${cy + 5} L${cx - 6.5},${cy + 5} Z`}
              className="anomaly"
              style={{ originX: `${cx}px`, originY: `${cy}px` }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ ...spring.settle, delay: reduce ? 0 : 0.6 + (i / n) * 0.9 + Math.min(k, 40) * 0.005 }}
            />
          );
        })}

        {hover != null && (
          <g pointerEvents="none">
            <m.line x1={crossX} x2={crossX} y1={M.top} y2={HEIGHT - M.bottom} className="crosshair" />
            {hy != null && <m.circle cx={crossX} cy={y(hy)} r={5} className="crosshair-dot" />}
          </g>
        )}
      </svg>

      <AnimatePresence>
        {hover != null && (
          <m.div
            className={`chart-tip ${tipLeft ? "chart-tip-left" : ""}`}
            style={{ x: crossX }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.14 }}
          >
            <strong>{dmy(dates[hover])}</strong>
            <span>Valor do dia: {fmt(hv, digits)}{unit && ` ${unit}`}</span>
            <span>Média de 7 dias: {fmt(hs, digits + 1)}{unit && ` ${unit}`}</span>
            {classes[hover] && <span>Classe do IQA: {classes[hover]}</span>}
            {anomalies[hover] && <span className="chart-tip-alert">Dia marcado como anormal pela IA</span>}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
