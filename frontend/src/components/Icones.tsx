// Ícones de traço usados no menu lateral e no chat da Limno (SVG inline, sem dependências).
import type { ReactNode } from 'react';

function Icone({ children, tamanho = 18 }: { children: ReactNode; tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const icones: Record<string, (p: { tamanho?: number }) => ReactNode> = {
  painel: (p) => (
    <Icone {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Icone>
  ),
  estacoes: (p) => (
    <Icone {...p}>
      <path d="M12 21s-6-5.6-6-11a6 6 0 1 1 12 0c0 5.4-6 11-6 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </Icone>
  ),
  imagens: (p) => (
    <Icone {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m21 16-5-5-9 9" />
    </Icone>
  ),
  analises: (p) => (
    <Icone {...p}>
      <path d="M3 3v18h18" />
      <path d="m7 15 4-4 3 3 6-7" />
    </Icone>
  ),
  anotacoes: (p) => (
    <Icone {...p}>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </Icone>
  ),
  assistente: (p) => (
    <Icone {...p}>
      <path d="M12 3c.4 3.9 2.1 5.6 6 6-3.9.4-5.6 2.1-6 6-.4-3.9-2.1-5.6-6-6 3.9-.4 5.6-2.1 6-6Z" />
      <path d="M19 15c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5Z" />
    </Icone>
  ),
  dados: (p) => (
    <Icone {...p}>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.5" />
      <path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13" />
      <path d="M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5" />
    </Icone>
  ),
  usuarios: (p) => (
    <Icone {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.2 2.4 3.5 5.2" />
    </Icone>
  ),
  sair: (p) => (
    <Icone {...p}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="m10 16-4-4 4-4M6 12h10" />
    </Icone>
  ),
  menu: (p) => (
    <Icone {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icone>
  ),
  enviar: (p) => (
    <Icone {...p}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </Icone>
  ),
  copiar: (p) => (
    <Icone {...p}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </Icone>
  ),
  feito: (p) => (
    <Icone {...p}>
      <path d="m5 12 5 5 9-10" />
    </Icone>
  ),
  novo: (p) => (
    <Icone {...p}>
      <path d="M12 5v14M5 12h14" />
    </Icone>
  ),
  fechar: (p) => (
    <Icone {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icone>
  ),
  info: (p) => (
    <Icone {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </Icone>
  ),
};
