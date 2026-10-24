import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useState, type FormEvent } from "react";
import { useDbSummary, type usePipeline } from "../api/client";
import type { DbSummary, Overview, PipelineStep } from "../api/types";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { fmt, shortPaths } from "../lib/format";
import { STAGES } from "../lib/stages";
import { ease, item, list, tap } from "../motion/tokens";

type Pipeline = ReturnType<typeof usePipeline>;
type StageState = "idle" | "active" | "done" | "fail";

function stageInfo(i: number, steps: PipelineStep[], running: boolean, data: Overview, db?: DbSummary): { state: StageState; time: string; output?: string } {
  const g = STAGES[i];
  const step = steps.findLast((s) => g.match.test(s.name));
  if (step) {
    const state = step.status === "ok" ? "done" : step.status === "erro" ? "fail" : "active";
    return { state, time: state === "active" ? "executando" : `${fmt(step.durationMs / 1000, 2)} s`, output: shortPaths(step.output.split("\n").at(-1) ?? "") };
  }
  if (running) return { state: "idle", time: "aguardando" };
  if (g.key === "publicar") return { state: "done", time: "no ar" };
  if (g.key === "guardar") return { state: "done", time: db ? `${fmt(db.totals.measurements)} leituras` : "—" };
  if (g.key === "limpar" && data.processing) return { state: "done", time: `${fmt(data.processing.total_ms)} ms` };
  if (g.key === "ia") return { state: "done", time: `${fmt(Object.values(data.timings_s).reduce((a, b) => a + b, 0), 1)} s` };
  return { state: "idle", time: db?.dataset?.source === "real" ? "dados reais" : "dados já existentes" };
}

export default function PipelineView({ data, pipeline }: { data: Overview; pipeline: Pipeline }) {
  const status = pipeline.data;
  const running = !!status?.running;
  const steps = status?.steps ?? [];
  const reduce = useReducedMotion();
  const db = useDbSummary().data;
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await pipeline.run();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar o pipeline.");
    }
  };

  const p = data.processing;
  const numbers = p ? [
    [p.rows_read, "leituras lidas"],
    [p.invalid_total, "valores impossíveis descartados"],
    [p.missing_values, "valores ausentes"],
    [p.interpolated_hourly, "lacunas curtas preenchidas"],
    [p.days_output, "dias consolidados"],
    [p.days_with_iqa, "dias com IQA calculado"],
  ] as const : [];

  return (
    <>
      <section className="pipeline-intro">
        <m.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: ease.out }}>Atualizar a análise</m.h1>
        <m.p className="lede" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: ease.out, delay: 0.12 }}>
          Aqui você recalcula tudo a partir dos dados guardados. São cinco etapas, do sensor ao alerta, e dá para acompanhar cada uma
          enquanto roda.
        </m.p>
      </section>

      <m.ol className="flow" variants={list} initial="hidden" animate="show" aria-label="Etapas da atualização">
        {STAGES.map((g, i) => {
          const info = stageInfo(i, steps, running, data, db);
          return (
            <m.li key={g.key} className={`stage is-${info.state}`} variants={item}>
              <m.span className="stage-bar" layout aria-hidden="true"
                animate={info.state === "active" && !reduce ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
                transition={info.state === "active" ? { duration: 1.1, repeat: Infinity } : { duration: 0.3 }}
              />
              {i > 0 && (
                <span className="pipe" aria-hidden="true">
                  {!reduce && [0, 1, 2].map((k) => (
                    <m.i key={k} animate={{ x: [-8, 36] }}
                      transition={{ duration: running ? 0.7 : 2.4, repeat: Infinity, ease: "linear", delay: k * (running ? 0.23 : 0.8) }} />
                  ))}
                </span>
              )}
              <span className="stage-lang">{g.title}</span>
              <p className="stage-what">{g.what}</p>
              <AnimatePresence mode="wait" initial={false}>
                <m.span key={info.time} className="stage-time" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                  {info.time}
                </m.span>
              </AnimatePresence>
              <details className="stage-tech">
                <summary>Detalhe técnico</summary>
                <span>{g.tech}{info.output ? `: ${info.output}` : ""}</span>
              </details>
            </m.li>
          );
        })}
      </m.ol>

      <m.section className="run-panel" aria-labelledby="run-title" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, margin: "-10%" }} transition={{ duration: 0.7, ease: ease.out }}>
        <div>
          <h2 id="run-title">Atualizar agora</h2>
          <p>
            Refaz todo o caminho a partir das leituras de sensores guardadas. Use depois de importar uma planilha nova ou quando
            quiser recalcular tudo.
          </p>
        </div>
        <form className="run-form" onSubmit={submit}>
          <m.button type="submit" className="button" disabled={running} whileTap={tap}>
            {running ? "Atualizando…" : "Atualizar análise"}
          </m.button>
          <AnimatePresence>
            {error && (
              <m.p className="form-error" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                {error}
              </m.p>
            )}
          </AnimatePresence>
        </form>
      </m.section>

      {numbers.length > 0 && (
        <m.dl className="numbers" variants={list} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-10%" }}>
          {numbers.map(([v, k]) => (
            <m.div key={k} variants={item}>
              <dt>{k}</dt>
              <dd><AnimatedNumber value={v} /></dd>
            </m.div>
          ))}
        </m.dl>
      )}
    </>
  );
}
