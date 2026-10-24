import { m, useInView } from "motion/react";
import { memo, useMemo } from "react";
import { useNavigate } from "react-router";
import type { Overview } from "../api/types";
import { SEVERITY, iqaClass, isLongTerm, riverOrder, shortName } from "../lib/domain";
import { dateRange, fmt, lowerFirst, monthLabel, toTime } from "../lib/format";
import { useElementWidth } from "../lib/useElementWidth";
import { ease } from "../motion/tokens";
import { useTooltip } from "./Tooltip";

const DAY = 86_400_000;

function TimelineImpl({ data }: { data: Overview }) {
  const [boxRef, boxWidth] = useElementWidth<HTMLDivElement>();
  const inView = useInView(boxRef, { once: true, margin: "0px 0px -15% 0px" });
  const navigate = useNavigate();
  const tooltip = useTooltip();
  const stations = useMemo(() => riverOrder(data.stations), [data.stations]);

  const W = Math.max(320, boxWidth);
  const narrow = W < 640;
  const labelW = narrow ? 0 : Math.min(230, W * 0.24);
  const rowH = narrow ? 58 : 48;
  const H = stations.length * rowH + 30;
  const t0 = toTime(data.period[0]);
  const t1 = toTime(data.period[1]) + DAY;
  const plotW = W - labelW;
  const x = (iso: string) => labelW + ((toTime(iso) - t0) / (t1 - t0)) * plotW;
  const xEnd = (iso: string) => x(iso) + (plotW * DAY) / (t1 - t0);
  /** Atraso de entrada: as marcas surgem da esquerda para a direita. */
  const delayAt = (px: number) => 0.35 + (px / W) * 1.1;

  const ticks = useMemo(() => {
    const out: string[] = [];
    const start = new Date(t0);
    const step = narrow ? 6 : 3;
    for (let k = 0; k < 30; k += step) {
      const d = new Date(start.getFullYear(), start.getMonth() + k, 1);
      if (d.getTime() >= t1) break;
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    }
    return out;
  }, [t0, t1, narrow]);

  const events = data.anomalies.evaluation?.events ?? [];
  const show = inView ? "show" : "hidden";

  return (
    <div className="timeline" ref={boxRef}>
      {boxWidth > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Linha do tempo de alertas e dias fora do padrão por estação" onPointerLeave={tooltip.hide}>
          {stations.map((s, r) => {
            const top = r * rowH;
            const cy = top + (narrow ? rowH - 18 : rowH / 2);
            return (
              <g key={s.id}>
                {narrow ? (
                  <text x={0} y={top + 16} className="tl-label">{s.name}</text>
                ) : (
                  <>
                    <text x={0} y={cy - 2} className="tl-label">{shortName(s.name)}</text>
                    <text x={0} y={cy + 15} className="tl-sub">IQA {fmt(s.iqa_30d)}, {iqaClass(s.iqa_30d)?.toLowerCase()}</text>
                  </>
                )}
                <m.rect
                  x={labelW} y={cy - 9} width={plotW} height={18} className="tl-track"
                  style={{ originX: 0 }}
                  initial={{ scaleX: 0 }}
                  animate={show}
                  variants={{ hidden: { scaleX: 0 }, show: { scaleX: 1 } }}
                  transition={{ duration: 1, ease: ease.out, delay: r * 0.06 }}
                />
                <rect
                  x={labelW} y={top} width={plotW} height={rowH} className="tl-hit"
                  onClick={() => navigate(`/estacoes/${s.id}`)}
                />
                {events.filter((e) => e.station_id === s.id).map((e) => (
                  <m.rect
                    key={e.start}
                    x={x(e.start) - 2} y={cy - 17} width={xEnd(e.end) - x(e.start) + 4} height={34}
                    className="tl-event"
                    initial={{ opacity: 0 }}
                    animate={show}
                    variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
                    transition={{ duration: 0.5, delay: delayAt(x(e.start)) }}
                    onPointerMove={(ev) => tooltip.show(
                      <>
                        <strong>Evento conhecido</strong>
                        <span>{e.description}, {dateRange(e.start, e.end)}.</span>
                        <span>{e.detected ? "A IA detectou este evento." : "A IA não detectou este evento."}</span>
                      </>, ev)}
                    onClick={() => navigate(`/estacoes/${s.id}?dia=${e.start}`)}
                  />
                ))}
                {data.alerts.filter((a) => a.station_id === s.id && !isLongTerm(a)).map((a) => (
                  <m.rect
                    key={a.id}
                    x={x(a.start)} y={cy - 6} width={Math.max(4, xEnd(a.end) - x(a.start))} height={12} rx={1.5}
                    fill={SEVERITY[a.severity].color}
                    className="tl-mark"
                    style={{ originY: `${cy}px` }}
                    initial={{ opacity: 0, scaleY: 0 }}
                    animate={show}
                    variants={{ hidden: { opacity: 0, scaleY: 0 }, show: { opacity: 1, scaleY: 1 } }}
                    transition={{ duration: 0.45, ease: ease.out, delay: delayAt(x(a.start)) }}
                    whileHover={{ scaleY: 1.5 }}
                    onPointerMove={(ev) => tooltip.show(
                      <>
                        <strong>{a.title}</strong>
                        <span>{a.message}</span>
                        <span>{SEVERITY[a.severity].label}, {dateRange(a.start, a.end)}.</span>
                      </>, ev)}
                    onClick={() => navigate(`/estacoes/${s.id}?dia=${a.start}`)}
                  />
                ))}
                {data.anomalies.episodes.filter((e) => e.station_id === s.id).map((ep) => {
                  const mid = x(ep.start) + (xEnd(ep.end) - x(ep.start)) / 2;
                  return (
                    <m.circle
                      key={ep.start}
                      cx={mid} cy={cy - 16} r={3.4} className="tl-anomaly"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={show}
                      variants={{ hidden: { opacity: 0, scale: 0 }, show: { opacity: 1, scale: 1 } }}
                      transition={{ type: "spring", stiffness: 400, damping: 20, delay: delayAt(mid) + 0.15 }}
                      whileHover={{ scale: 1.8 }}
                      onPointerMove={(ev) => tooltip.show(
                        <>
                          <strong>Dia fora do padrão (IA)</strong>
                          <span>{dateRange(ep.start, ep.end)}.</span>
                          {ep.params.length > 0 && (
                            <span>Mais afetados: {ep.params.map((p) => lowerFirst(data.parameters[p]?.label ?? p)).join(", ")}.</span>
                          )}
                        </>, ev)}
                      onClick={() => navigate(`/estacoes/${s.id}?dia=${ep.start}`)}
                    />
                  );
                })}
              </g>
            );
          })}
          {ticks.map((iso, i) => (
            <text key={iso} x={x(iso)} y={stations.length * rowH + 22} className="tl-axis" textAnchor={i === 0 ? "start" : "middle"}>
              {monthLabel(iso)}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

export const Timeline = memo(TimelineImpl);
