import type { Transition, Variants } from "motion/react";

// Curvas e molas usadas em todo o app. Uma única fonte evita que cada
// componente invente seu próprio tempo, que é o que faz animação parecer amadora.

export const ease = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.76, 0, 0.24, 1],
  soft: [0.33, 1, 0.68, 1],
} as const;

export const spring = {
  /** Indicadores que trocam de lugar (navegação, seleção). */
  snappy: { type: "spring", stiffness: 520, damping: 42, mass: 0.9 } satisfies Transition,
  /** Elementos que entram e se acomodam. */
  settle: { type: "spring", stiffness: 210, damping: 28 } satisfies Transition,
  /** Números que contam. Lento no fim, sem passar do valor. */
  number: { type: "spring", stiffness: 110, damping: 24, restDelta: 0.01 } satisfies Transition,
  /** Ponteiros que seguem o mouse. */
  follow: { stiffness: 700, damping: 50, mass: 0.5 },
};

export const duration = { press: 0.14, hover: 0.18, ui: 0.24, reveal: 0.7, draw: 1.1 };

/** Transição entre as vistas: só esmaece, para o desenho do rio ser o único movimento de destaque. */
export const page: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: 0.3, ease: ease.out } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: ease.out } },
};

/** Lista que chega item a item quando entra na tela. */
export const list: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } },
};

export const item: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3, ease: ease.out } },
};

export const tap = { scale: 0.97 };
