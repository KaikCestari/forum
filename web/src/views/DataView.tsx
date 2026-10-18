import { AnimatePresence, m } from "motion/react";
import { useMemo, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { importData, useDbSummary, useMonthly, useRuns, type usePipeline } from "../api/client";
import type { ImportResult, MonthlyRow, Overview } from "../api/types";
import { useTooltip } from "../components/Tooltip";
import { IQA_COLOR, iqaClass, riverOrder } from "../lib/domain";
import { dmy, fmt, monthLabel, plural } from "../lib/format";
import { ease, item, list, tap } from "../motion/tokens";

type Pipeline = ReturnType<typeof usePipeline>;

const day = (s: string | null) => (s ? dmy(s.slice(0, 10)) : "—");
const when = (s: string) => new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const reveal = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-10%" },
  transition: { duration: 0.7, ease: ease.out },
};

export default function DataView({ data, pipeline }: { data: Overview; pipeline: Pipeline }) {
  const db = useDbSummary().data;
  const ds = db?.dataset;
  const t = db?.totals;

  return (
    <>
      <section className="data-intro" aria-labelledby="data-title">
        <m.p className="eyebrow" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: ease.out }}>
          {!ds ? "Banco H2 vazio" : ds.source === "real" ? "Dados reais" : "Dados sintéticos de demonstração"}
        </m.p>
        <m.h1 id="data-title" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: ease.out, delay: 0.06 }}>
          {ds?.name ?? "Nenhum conjunto carregado"}
        </m.h1>
        <m.p className="lede" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: ease.out, delay: 0.14 }}>
          {t?.measurements
            ? `${plural(t.measurements, "leitura", "leituras")} de ${plural(t.stations, "estação", "estações")}, de ${day(t.first_reading)} a ${day(t.last_reading)}. ` +
              `O banco H2 guarda também ${plural(t.runs, "análise", "análises")} e ${plural(t.messages, "pergunta", "perguntas")} ao Llama.`
            : "Importe um CSV abaixo ou execute o pipeline para gerar dados de demonstração."}
        </m.p>
      </section>

      <ImportPanel pipeline={pipeline} />
      <MonthlyHeat data={data} />

      <section className="data-split">
        <div>
          <h2>Leituras guardadas</h2>
          <m.ul className="db-list" variants={list} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-10%" }}>
            {(db?.stations ?? []).map((s) => (
              <m.li key={s.id} variants={item}>
                <span className="db-name">{s.name}</span>
                <span className="db-count">{fmt(s.readings)}</span>
                <span className="db-meta">
                  {s.id}, {s.type}, {fmt(s.readings_per_day, 1)} leituras por dia, de {day(s.first_reading)} a {day(s.last_reading)}
                </span>
              </m.li>
            ))}
          </m.ul>
          {!db?.stations.length && <p className="empty">Nenhuma leitura no banco.</p>}
        </div>
        <RunHistory />
      </section>
    </>
  );
}

function ImportPanel({ pipeline }: { pipeline: Pipeline }) {
  const form = useRef<HTMLFormElement>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = !!pipeline.data?.running;
  // A importação só falha depois, no pipeline (ex.: poucas leituras por dia).
  const pipelineError = result && !running ? pipeline.data?.error : null;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    for (const k of ["stations", "events"]) {
      if (!(fd.get(k) as File | null)?.size) fd.delete(k);
    }
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const r = await importData(fd);
      setResult(r);
      form.current?.reset();
      await pipeline.follow(r.pipeline);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível importar os arquivos.");
    } finally {
      setSending(false);
    }
  };

  return (
    <m.section className="import-panel" aria-labelledby="import-title" {...reveal}>
      <div>
        <h2 id="import-title">Importar dados reais</h2>
        <p>
          Envie as leituras dos seus sensores em CSV. O AquaML grava tudo no banco H2, substitui o conjunto atual e refaz a análise
          inteira com os mesmos modelos.
        </p>
        <p className="format">
          Colunas: <code>timestamp</code> e <code>station_id</code>, mais os parâmetros que você tiver (<code>ph</code>, <code>do_mgl</code>,{" "}
          <code>temp_c</code>, <code>turbidity_ntu</code>, <code>conductivity_uscm</code>, <code>nitrate_mgl</code>, <code>phosphorus_mgl</code>,{" "}
          <code>coliforms_nmp</code>). Também aceita <code>;</code> com vírgula decimal, datas <code>dd/mm/aaaa hh:mm</code> e cabeçalhos como
          “Data/Hora”, “Estação”, “OD (mg/L)” ou “Fósforo total”. Cada dia precisa de pelo menos 6 leituras, como as de sensores contínuos.
        </p>
      </div>
      <form ref={form} className="import-form" onSubmit={submit}>
        <label className="file-field">
          <span>Leituras <em>obrigatório</em></span>
          <input type="file" name="measurements" accept=".csv,text/csv" required />
        </label>
        <label className="file-field">
          <span>Estações <em>opcional: id, nome, tipo, lat, lon</em></span>
          <input type="file" name="stations" accept=".csv,text/csv" />
        </label>
        <label className="file-field">
          <span>Eventos conhecidos <em>opcional: servem para avaliar a IA</em></span>
          <input type="file" name="events" accept=".csv,text/csv" />
        </label>
        <label className="file-field">
          <span>Nome do conjunto</span>
          <input type="text" name="name" placeholder="ex.: Rede municipal, 2025" />
        </label>
        <m.button type="submit" className="button" disabled={sending || running} whileTap={tap}>
          {sending ? "Enviando…" : running ? "Analisando…" : "Importar e analisar"}
        </m.button>
        <AnimatePresence mode="wait">
          {(error || pipelineError) && (
            <m.p key="error" className="form-error" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              {error ?? `A análise falhou: ${pipelineError}`}
            </m.p>
          )}
          {result && !pipelineError && (
            <m.div key="ok" className="form-ok" role="status" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <p>
                {plural(result.measurements, "leitura", "leituras")} de {plural(result.stations, "estação", "estações")} recebidas
                ({fmt(result.readingsPerDay, 1)} por dia). {running ? "A análise está rodando e o painel se atualiza sozinho." : "Análise concluída."}
              </p>
              {result.warnings.length > 0 && <ul>{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
            </m.div>
          )}
        </AnimatePresence>
      </form>
    </m.section>
  );
}

function MonthlyHeat({ data }: { data: Overview }) {
  const rows = useMonthly().data ?? [];
  const tooltip = useTooltip();
  const real = useDbSummary().data?.dataset?.source === "real";
  const { months, byKey, ids, names } = useMemo(() => {
    const byKey = new Map(rows.map((r) => [`${r.station_id}|${r.month}`, r]));
    const known = new Set(rows.map((r) => r.station_id));
    const ids = riverOrder(data.stations, real).map((s) => s.id).filter((id) => known.has(id));
    const names = new Map(data.stations.map((s) => [s.id, s.name]));
    return { months: [...new Set(rows.map((r) => r.month))].sort(), byKey, ids, names };
  }, [rows, data.stations, real]);

  const tip = (r: MonthlyRow, e: PointerEvent) =>
    tooltip.show(
      <>
        <strong>{names.get(r.station_id) ?? r.station_id}, {monthLabel(r.month)}</strong>
        <span>IQA médio {fmt(r.iqa_mean)} ({iqaClass(r.iqa_mean)?.toLowerCase()}), pior dia {fmt(r.iqa_min)}.</span>
        <span>OD {fmt(r.do_mean, 1)} mg/L, fósforo {fmt(r.phosphorus_mean, 3)} mg/L.</span>
        <span>{r.anomaly_days} de {r.days} dias anormais segundo a IA.</span>
      </>,
      e,
    );

  return (
    <section className="data-block" aria-labelledby="heat-title">
      <div className="block-head">
        <h2 id="heat-title">IQA mês a mês</h2>
        <p>
          Média mensal do IQA de cada estação, calculada por uma consulta SQL no H2 sobre a série diária da última análise. Passe o mouse
          para ver o pior dia e os dias anormais.
        </p>
      </div>
      {rows.length ? (
        <div className="table-wrap">
          <table className="heat" onPointerLeave={tooltip.hide}>
            <thead>
              <tr><th />{months.map((mo) => <th key={mo} scope="col">{monthLabel(mo)}</th>)}</tr>
            </thead>
            <tbody>
              {ids.map((id) => (
                <tr key={id}>
                  <th scope="row">{names.get(id) ?? id}</th>
                  {months.map((mo) => {
                    const r = byKey.get(`${id}|${mo}`);
                    const cls = iqaClass(r?.iqa_mean);
                    if (!r || !cls) return <td key={mo} className="is-empty">—</td>;
                    return (
                      <td key={mo} className={cls === "Regular" ? "is-light" : undefined} style={{ ["--c" as string]: IQA_COLOR[cls] }} onPointerMove={(e) => tip(r, e)}>
                        {fmt(r.iqa_mean)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">Sem série diária no banco.</p>
      )}
    </section>
  );
}

function RunHistory() {
  const runs = useRuns().data ?? [];
  return (
    <div>
      <h2>Histórico de análises</h2>
      <m.ol className="runs" variants={list} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-10%" }}>
        {runs.slice(0, 12).map((r, i) => (
          <m.li key={r.id} className={i === 0 ? "is-current" : undefined} variants={item}>
            <span className="run-id">nº {r.id}</span>
            <span className="run-name">{r.dataset_name ?? "—"}</span>
            <span className="run-source">{r.source === "real" ? "real" : "sintético"}</span>
            <span className="run-meta">
              {when(r.created_at)}, {day(r.period_start)} a {day(r.period_end)}, {plural(r.stations, "estação", "estações")}, IQA médio{" "}
              {fmt(r.mean_iqa)}, {plural(r.alerts, "alerta", "alertas")} ({r.critical_alerts} críticos)
              {r.accuracy != null && `, acurácia ${fmt(r.accuracy * 100)}%`}
            </span>
          </m.li>
        ))}
      </m.ol>
      {!runs.length && <p className="empty">Nenhuma análise ainda.</p>}
    </div>
  );
}
