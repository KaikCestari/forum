import { AnimatePresence, m } from "motion/react";
import { Link, NavLink } from "react-router";
import type { PipelineStatus } from "../api/types";
import { dmy, lowerFirst } from "../lib/format";
import { friendlyStep } from "../lib/stages";
import { ease, spring } from "../motion/tokens";

const LINKS = [
  { to: "/", label: "Visão geral", end: true },
  { to: "/imagens", label: "Imagens", end: false },
  { to: "/estacoes", label: "Estações", end: false },
  { to: "/analises", label: "Análises da IA", end: false },
  { to: "/relatorio", label: "Relatório", end: false },
  { to: "/dados", label: "Meus dados", end: false },
  { to: "/assistente", label: "Assistente", end: false },
  { to: "/guia", label: "Guia", end: false },
];

interface Props {
  pipeline?: PipelineStatus;
  period?: [string, string];
}

export function AppBar({ pipeline, period }: Props) {
  const running = !!pipeline?.running;
  const step = pipeline?.steps.at(-1);
  const state = running
    ? step ? `Atualizando: ${lowerFirst(friendlyStep(step.name))}` : "Iniciando a atualização"
    : pipeline?.error ? "A atualização falhou"
    : period ? `Dados de ${dmy(period[0])} a ${dmy(period[1])}` : "";

  return (
    <header className="bar">
      <Link to="/" className="wordmark">AquaML</Link>
      <nav className="nav" aria-label="Seções">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className="nav-link">
            {({ isActive }) => (
              <>
                {l.label}
                {isActive && <m.span layoutId="nav-indicator" className="nav-indicator" transition={spring.snappy} />}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <Link to="/atualizar" className={`bar-state ${running ? "is-running" : ""}`}>
        <AnimatePresence mode="wait" initial={false}>
          <m.span key={state} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: ease.out }}>
            {state}
          </m.span>
        </AnimatePresence>
      </Link>
      <AnimatePresence>
        {running && (
          <m.div className="bar-progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden="true">
            <m.span animate={{ x: ["-100%", "330%"] }} transition={{ duration: 1.3, repeat: Infinity, ease: "linear" }} />
          </m.div>
        )}
      </AnimatePresence>
    </header>
  );
}
