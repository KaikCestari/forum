import { m, useInView } from "motion/react";
import { useMemo, useRef } from "react";
import { ease } from "../motion/tokens";

interface Props {
  values: (number | null)[];
  width: number;
  height: number;
  delay?: number;
  color?: string;
  strokeWidth?: number;
}

/** Linha mínima de tendência, que se desenha quando entra na tela. */
export function Sparkline({ values, width, height, delay = 0, color = "currentColor", strokeWidth = 1.5 }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true });
  const d = useMemo(() => {
    const valid = values.filter((v): v is number => v != null);
    if (valid.length < 2) return "";
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of valid) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const span = hi - lo || 1;
    const last = values.length - 1;
    return values
      .map((v, i) => (v == null ? null : `${((i / last) * width).toFixed(1)},${(height - 2 - ((v - lo) / span) * (height - 4)).toFixed(1)}`))
      .filter(Boolean)
      .map((p, i) => `${i ? "L" : "M"}${p}`)
      .join("");
  }, [values, width, height]);

  return (
    <svg ref={ref} viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true" className="sparkline">
      <m.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={inView ? { pathLength: 1, opacity: 1 } : undefined}
        transition={{ pathLength: { duration: 1.2, ease: ease.inOut, delay }, opacity: { duration: 0.2, delay } }}
      />
    </svg>
  );
}
