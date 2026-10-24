import type { ReactNode } from "react";

/** Detalhe técnico recolhido: quem quer saber o método abre, quem quer a resposta passa direto. */
export function HowItWorks({ children, label = "Como funciona" }: { children: ReactNode; label?: string }) {
  return (
    <details className="how">
      <summary>{label}</summary>
      <div className="how-body">{children}</div>
    </details>
  );
}
