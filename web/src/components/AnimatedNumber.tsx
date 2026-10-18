import { animate, m, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useRef, type CSSProperties } from "react";
import { fmt } from "../lib/format";
import { spring } from "../motion/tokens";

interface Props {
  value: number | null | undefined;
  digits?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Número que conta até o valor quando aparece e, se o valor mudar depois
 * (outra estação, novo pipeline), desliza do valor antigo para o novo.
 */
export function AnimatedNumber({ value, digits = 0, className, style }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => fmt(v, digits));

  useEffect(() => {
    if (value == null || !inView) return;
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, spring.number);
    return () => controls.stop();
  }, [value, inView, reduce, mv]);

  if (value == null) return <span className={className} style={style}>—</span>;
  return (
    <m.span ref={ref} className={className} style={style} aria-label={fmt(value, digits)}>
      {text}
    </m.span>
  );
}
