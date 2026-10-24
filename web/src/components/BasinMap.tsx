import { m, useReducedMotion } from "motion/react";
import { memo, useMemo } from "react";
import { useNavigate } from "react-router";
import { useDbSummary } from "../api/client";
import type { Overview } from "../api/types";
import { IQA_COLOR, MAIN_RIVER, hadRecentCritical, iqaClass, riverOrder, shortName, stationLayout } from "../lib/domain";
import { fmt } from "../lib/format";
import { ease, spring } from "../motion/tokens";
import { useTooltip } from "./Tooltip";

const TRIBUTARY: [number, number][] = [[176, 14], [214, 54], [262, 96], [296, 170], [330, 238]];

/** Curva suave (Catmull-Rom convertida em Bézier) que passa por todos os pontos. */
function smoothPath(pts: [number, number][]): string {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

const MAIN = { d: smoothPath(MAIN_RIVER), width: 10, delay: 0 };
/** O afluente e o terreno só existem no esquema da bacia sintética. */
const RIVERS_SCHEMATIC = [{ d: smoothPath(TRIBUTARY), width: 6, delay: 0.2 }, MAIN];
const RIVERS_PLAIN = [MAIN];
const DRAW = 2.1;
/** Momento em que a água "chega" a cada ponto x do esquema. */
const arrival = (x: number) => 0.25 + (x / 1000) * DRAW;

const FOREST = [[34, 300, 16], [58, 318, 13], [84, 300, 15], [108, 322, 12], [62, 286, 10], [128, 300, 10]];

/** Terreno desenhado a partir do assunto: mata, lavouras, cidade, barragem, oceano. Estático, fica fora do render. */
const terrain = (
  <g aria-hidden="true">
    {FOREST.map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} className="land" />)}
    <text x={34} y={352} className="map-label">mata da nascente</text>
    {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={96 + i * 15} y={60} width={9} height={58} className="land" />)}
    <text x={96} y={46} className="map-label">lavouras</text>
    {[0, 1].flatMap((r) => [0, 1, 2, 3, 4].map((c) => (
      <rect key={`${r}-${c}`} x={352 + c * 22} y={158 + r * 18} width={16} height={12} className="land" />
    )))}
    <text x={352} y={146} className="map-label">área urbana</text>
  </g>
);

interface Props {
  data: Overview;
}

function BasinMapImpl({ data }: Props) {
  const navigate = useNavigate();
  const tooltip = useTooltip();
  const reduce = useReducedMotion();
  const real = useDbSummary().data?.dataset?.source === "real";
  const { schematic, pos: positions } = useMemo(() => stationLayout(data.stations, real), [data.stations, real]);
  const stations = useMemo(() => riverOrder(data.stations, real), [data.stations, real]);

  return (
    <svg viewBox="0 0 1000 440" className="basin-map" role="group" aria-label="Esquema da bacia com as estações de monitoramento">
      <defs>
        <pattern id="graticule" width={50} height={50} patternUnits="userSpaceOnUse">
          <path d="M50,0 L0,0 L0,50" className="graticule-line" />
        </pattern>
      </defs>
      <rect width={1000} height={440} fill="url(#graticule)" aria-hidden="true" />
      {schematic && terrain}

      {schematic && <g aria-hidden="true">
        <m.ellipse
          cx={570} cy={196} rx={64} ry={28} transform="rotate(-14 570 196)" className="water"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: arrival(570), ease: ease.out }}
        />
        <m.ellipse
          cx={726} cy={258} rx={76} ry={24} transform="rotate(12 726 258)" className="water"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: arrival(726), ease: ease.out }}
        />
        <m.path
          d="M872,294 C925,292 962,280 1000,268 L1000,436 C962,390 925,330 872,306 Z" className="water"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: arrival(880), ease: ease.out }}
        />
        <m.rect
          x={798} y={258} width={8} height={40} rx={2} transform="rotate(12 802 278)" className="dam"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: arrival(800) }}
        />
        <text x={806} y={352} className="map-label">barragem</text>
        <text x={992} y={428} className="map-label map-label-strong" textAnchor="end">oceano</text>
      </g>}

      {(schematic ? RIVERS_SCHEMATIC : RIVERS_PLAIN).map((r) => (
        <g key={r.d} aria-hidden="true">
          <m.path
            d={r.d}
            className="river-shore"
            strokeWidth={r.width * 2.8}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: DRAW, delay: r.delay, ease: ease.inOut }}
          />
          <m.path
            d={r.d}
            className="river"
            strokeWidth={r.width}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: DRAW, delay: r.delay, ease: ease.inOut }}
          />
          {!reduce && (
            <m.path
              d={r.d}
              className="river-flow"
              strokeWidth={Math.max(2, r.width / 3)}
              initial={{ opacity: 0, strokeDashoffset: 0 }}
              animate={{ opacity: 1, strokeDashoffset: -28 }}
              transition={{
                opacity: { delay: DRAW + 0.2, duration: 0.6 },
                strokeDashoffset: { repeat: Infinity, ease: "linear", duration: 2.6 },
              }}
            />
          )}
        </g>
      ))}

      {stations.map((s) => {
        const pos = positions[s.id];
        if (!pos) return null;
        const cls = iqaClass(s.iqa_30d)!;
        const critical = hadRecentCritical(data, s.id);
        const [nx, ny, sy, anchor] = {
          top: [pos.x, pos.y - 50, pos.y - 28, "middle"],
          bottom: [pos.x, pos.y + 46, pos.y + 68, "middle"],
          right: [pos.x + 28, pos.y - 3, pos.y + 19, "start"],
        }[pos.label] as [number, number, number, "middle" | "start"];
        const open = () => navigate(`/estacoes/${s.id}`);

        return (
          <m.g
            key={s.id}
            className="station-node"
            tabIndex={0}
            role="link"
            aria-label={`${s.name}: IQA ${fmt(s.iqa_30d)}, água ${cls.toLowerCase()}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.settle, delay: arrival(pos.x) + 0.15 }}
            whileHover="hover"
            whileFocus="hover"
            onClick={open}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                open();
              }
            }}
            onPointerMove={(e) =>
              tooltip.show(
                <>
                  <strong>{s.name}</strong>
                  <span>IQA {fmt(s.iqa_30d)} nos últimos 30 dias, água {cls.toLowerCase()}.</span>
                  <span>{s.alerts_recent ? `${s.alerts_recent} alerta(s) no último mês.` : "Sem alertas no último mês."}</span>
                </>,
                e,
              )
            }
            onPointerLeave={tooltip.hide}
          >
            {critical && !reduce && (
              <m.circle
                cx={pos.x} cy={pos.y} r={15} className="halo"
                style={{ originX: `${pos.x}px`, originY: `${pos.y}px` }}
                animate={{ scale: [1, 2.5], opacity: [0.7, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: ease.out, delay: arrival(pos.x) + 0.8 }}
              />
            )}
            <m.circle
              cx={pos.x} cy={pos.y} r={15} fill={IQA_COLOR[cls]} className="station-dot"
              variants={{ hover: { scale: 1.3 } }}
              transition={spring.snappy}
            />
            <text x={nx} y={ny} textAnchor={anchor} className="station-name">{shortName(s.name)}</text>
            <text x={nx} y={sy} textAnchor={anchor} className="station-sub">IQA {fmt(s.iqa_30d)}, {cls.toLowerCase()}</text>
          </m.g>
        );
      })}
    </svg>
  );
}

export const BasinMap = memo(BasinMapImpl);
