import { m, useInView, useReducedMotion } from "motion/react";
import { extent } from "d3-array";
import { scaleLinear } from "d3-scale";
import { useMemo, useRef } from "react";
import type { Clusters, Station } from "../api/types";
import { fmt, monthLabel } from "../lib/format";
import { useElementWidth } from "../lib/useElementWidth";
import { useTooltip } from "./Tooltip";

export const CLUSTER_COLORS = ["var(--series-1)", "var(--series-3)", "var(--series-2)"];
const HEIGHT = 420;
const PAD = 24;

interface Props {
  clusters: Clusters;
  stations: Station[];
  active: number | null;
}

/**
 * Cada ponto é um mês de uma estação. Os pontos nascem no centro do seu grupo
 * e se espalham até a posição real, mostrando que o grupo veio primeiro.
 */
export function ClusterScatter({ clusters, stations, active }: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const inView = useInView(svgRef, { once: true, margin: "-15%" });
  const reduce = useReducedMotion();
  const tooltip = useTooltip();
  const names = useMemo(() => new Map(stations.map((s) => [s.id, s.name])), [stations]);

  const geo = useMemo(() => {
    if (!width) return null;
    const [x0, x1] = extent(clusters.points, (p) => p.x) as [number, number];
    const [y0, y1] = extent(clusters.points, (p) => p.y) as [number, number];
    const x = scaleLinear().domain([x0, x1]).range([PAD, width - PAD]).nice();
    const y = scaleLinear().domain([y0, y1]).range([HEIGHT - PAD, PAD]).nice();
    const centers = new Map<number, { x: number; y: number }>();
    for (const prof of clusters.profiles) {
      const pts = clusters.points.filter((p) => p.cluster === prof.cluster);
      centers.set(prof.cluster, {
        x: pts.reduce((s, p) => s + x(p.x), 0) / pts.length,
        y: pts.reduce((s, p) => s + y(p.y), 0) / pts.length,
      });
    }
    return { x, y, centers };
  }, [width, clusters]);

  return (
    <div ref={ref} className="scatter">
      {geo && (
        <svg ref={svgRef} width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img"
          aria-label="Meses de cada estação agrupados por semelhança" onPointerLeave={tooltip.hide}>
          {clusters.points.map((p, i) => {
            const c = geo.centers.get(p.cluster)!;
            const tx = geo.x(p.x);
            const ty = geo.y(p.y);
            const dim = active != null && active !== p.cluster;
            return (
              <m.circle
                key={`${p.station_id}-${p.month}`}
                r={6}
                fill={CLUSTER_COLORS[p.cluster]}
                className="scatter-point"
                initial={{ cx: c.x, cy: c.y, opacity: 0 }}
                animate={inView ? { cx: tx, cy: ty, opacity: dim ? 0.12 : 1 } : undefined}
                transition={{
                  cx: { type: "spring", stiffness: 70, damping: 14, delay: reduce ? 0 : 0.2 + (i % 48) * 0.012 },
                  cy: { type: "spring", stiffness: 70, damping: 14, delay: reduce ? 0 : 0.2 + (i % 48) * 0.012 },
                  opacity: { duration: 0.25 },
                }}
                whileHover={{ r: 9 }}
                onPointerMove={(e) => tooltip.show(
                  <>
                    <strong>{names.get(p.station_id)}</strong>
                    <span>{monthLabel(p.month)}, IQA {fmt(p.iqa)}.</span>
                  </>, e)}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}
