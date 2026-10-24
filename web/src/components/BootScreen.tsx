import { m } from "motion/react";
import type { PipelineStatus } from "../api/types";
import { friendlyStep } from "../lib/stages";
import { ease } from "../motion/tokens";

interface Props {
  error?: Error & { status?: number };
  pipeline?: PipelineStatus;
}

/** O que aparece antes de existirem resultados: carregando, pipeline rodando ou API fora do ar. */
export function BootScreen({ error, pipeline }: Props) {
  const apiDown = error && !error.status;
  const step = pipeline?.steps.at(-1);

  let title = "Carregando a bacia";
  let text = "Buscando os resultados mais recentes.";
  if (apiDown) {
    title = "O sistema não respondeu";
    text = "Peça a quem administra para iniciar o sistema (make run). Esta página tenta de novo sozinha.";
  } else if (pipeline?.error) {
    title = "A análise falhou";
    text = pipeline.error;
  } else if (pipeline?.running) {
    title = "Preparando a primeira análise";
    text = step ? `${friendlyStep(step.name)}.` : "Iniciando a análise.";
  }

  return (
    <main className="main boot" aria-live="polite">
      <m.div className="boot-drop" aria-hidden="true" animate={{ y: [0, 10, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: ease.inOut }} />
      <h1>{title}</h1>
      <p className="lede">{text}</p>
    </main>
  );
}
