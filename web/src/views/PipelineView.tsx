import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useState, type FormEvent } from "react";
import type { usePipeline } from "../api/client";
import type { Overview, PipelineStep } from "../api/types";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { fmt } from "../lib/format";
import { ease, item, list, tap } from "../motion/tokens";

const STAGES = [
  { lang: "Python", match: "Geração", task: "Gera os dados", what: "Seis estações, dois anos de leituras horárias, falhas de sensor e sete eventos ambientais escondidos." },
  { lang: "Rust", match: "Processamento", task: "Processa e calcula o IQA", what: "Descarta leituras impossíveis, preenche lacunas, consolida por dia e calcula o índice, em paralelo." },
  { lang: "Python", match: "Análise", task: "Aprende com os dados", what: "Isolation Forest, Random Forest, K-Means e Mann-Kendall transformam números em alertas." },
  { lang: "Java", match: null, task: "Coordena e entrega", what: "Executa cada etapa na ordem, guarda os resultados e serve a API que este painel consome." },
] as const;

type Pipeline = ReturnType<typeof usePipeline>;
type StageState = "idle" | "active" | "done" | "fail";

function stageInfo(i: number, steps: PipelineStep[], running: boolean, data: Overview): { state: StageState; time: string; output?: string } {
  const g = STAGES[i];
  const step = g.match ? steps.find((s) => s.name.includes(g.match)) : undefined;
  if (step) {
    const state = step.status === "ok" ? "done" : step.status === "erro" ? "fail" : "active";
    return { state, time: state === "active" ? "executando" : `${fmt(step.durationMs / 1000, 2)} s`, output: step.output.split("\n").at(-1) };
  }
  if (g.lang === "Java") return { state: running ? "active" : "done", time: running ? "coordenando" : "no ar" };
  if (running) return { state: "idle", time: "aguardando" };
  if (g.lang === "Rust" && data.processing) return { state: "done", time: `${fmt(data.processing.total_ms)} ms` };
  if (g.match === "Análise") return { state: "done", time: `${fmt(Object.values(data.timings_s).reduce((a, b) => a + b, 0), 1)} s` };
  return { state: "idle", time: "dados já existentes" };
}

export default function PipelineView({ data, pipeline }: { data: Overview; pipeline: Pipeline }) {
  const status = pipeline.data;
  const running = !!status?.running;
  const steps = status?.steps ?? [];
  const reduce = useReducedMotion();
  const [regenerate, setRegenerate] = useState(false);
  const [seed, setSeed] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await pipeline.run(regenerate, seed);
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
    [p.threads, "threads em paralelo no Rust"],
  ] as const : [];

  return (
    <>
      <section className="pipeline-intro">
        <m.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: ease.out }}>Do sensor ao alerta</m.h1>
        <m.p className="lede" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: ease.out, delay: 0.12 }}>
          Três linguagens, cada uma no que faz melhor. O Java coordena, o Rust processa o volume e o Python aprende com os dados.
        </m.p>
      </section>

      <m.ol className="flow" variants={list} initial="hidden" animate="show" aria-label="Etapas do pipeline">
        {STAGES.map((g, i) => {
          const info = stageInfo(i, steps, running, data);
          return (
            <m.li key={g.task} className={`stage is-${info.state}`} variants={item}>
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
              <span className="stage-lang">{g.lang}</span>
              <span className="stage-task">{g.task}</span>
              <p className="stage-what">{g.what}</p>
              <AnimatePresence mode="wait" initial={false}>
                <m.span key={info.time} className="stage-time" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                  {info.time}
                </m.span>
              </AnimatePresence>
              {info.output && <span className="stage-out">{info.output}</span>}
            </m.li>
          );
        })}
      </m.ol>

      <m.section className="run-panel" aria-labelledby="run-title" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-10%" }} transition={{ duration: 0.7, ease: ease.out }}>
        <div>
          <h2 id="run-title">Executar de novo</h2>
          <p>
            Refaz todo o caminho. Com novos dados, o gerador cria outro cenário, com outros eventos e outro ruído, e a IA precisa
            encontrá-los sem saber onde estão.
          </p>
        </div>
        <form className="run-form" onSubmit={submit}>
          <label className="toggle">
            <input type="checkbox" checked={regenerate} onChange={(e) => setRegenerate(e.target.checked)} />
            Gerar novos dados
          </label>
          <label className="seed">
            Semente
            <input type="number" inputMode="numeric" placeholder="aleatória" value={seed} onChange={(e) => setSeed(e.target.value)} disabled={!regenerate} />
          </label>
          <m.button type="submit" className="button" disabled={running} whileTap={tap}>
            {running ? "Executando…" : "Executar pipeline"}
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
