import { AnimatePresence, m, useMotionValue, useSpring } from "motion/react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { spring } from "../motion/tokens";

interface TooltipApi {
  show: (content: ReactNode, e: PointerEvent | MouseEvent) => void;
  hide: () => void;
}

const TooltipContext = createContext<TooltipApi>({ show: () => {}, hide: () => {} });

export const useTooltip = () => useContext(TooltipContext);

/** Uma dica flutuante para o app inteiro, que segue o ponteiro com mola. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode>(null);
  const visible = useRef(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, spring.follow);
  const sy = useSpring(y, spring.follow);

  const show = useCallback((next: ReactNode, e: PointerEvent | MouseEvent) => {
    const pad = 16;
    const flipX = e.clientX > window.innerWidth - 320;
    const flipY = e.clientY > window.innerHeight - 160;
    const nx = flipX ? e.clientX - 300 - pad : e.clientX + pad;
    const ny = flipY ? e.clientY - 120 : e.clientY + pad;
    // Ao aparecer, a dica nasce no ponteiro; depois, segue com mola.
    if (!visible.current) {
      sx.jump(nx);
      sy.jump(ny);
      visible.current = true;
    }
    x.set(nx);
    y.set(ny);
    setContent(next);
  }, [x, y, sx, sy]);

  const hide = useCallback(() => {
    visible.current = false;
    setContent(null);
  }, []);
  const api = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <TooltipContext.Provider value={api}>
      {children}
      <AnimatePresence>
        {content != null && (
          <m.div
            className="tooltip"
            role="tooltip"
            style={{ x: sx, y: sy }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16 }}
          >
            {content}
          </m.div>
        )}
      </AnimatePresence>
    </TooltipContext.Provider>
  );
}
