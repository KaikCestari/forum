import { AnimatePresence, m } from "motion/react";
import { useMemo, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { Link } from "react-router";
import { clearSensorData, importData, useDbSummary, useImages, useMonthly, usePoints, useRuns, type usePipeline } from "../api/client";
import type { ImportResult, MonthlyRow, Overview } from "../api/types";
import { HowItWorks } from "../components/HowItWorks";
import { useTooltip } from "../components/Tooltip";
import { IQA_COLOR, iqaClass, riverOrder } from "../lib/domain";
import { READINGS_TEMPLATE, STATIONS_TEMPLATE, downloadText } from "../lib/export";
import { STATION_TYPE_LABEL } from "../lib/guide";
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

export default function DataView({ data, pipeline }: { data?: Overview; pipeline: Pipeline }) {
  const db = useDbSummary().data;
  const ds = db?.dataset;

  return (
    <>
      <section className="data-intro" aria-labelledby="data-title">
        <m.h1 id="data-title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: ease.out }}>
          Meus dados
        </m.h1>
        <m.p className="lede" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: ease.out, delay: 0.1 }}>
          Traga seus dados por imagem, por planilha de sensores ou pelos dois caminhos. Tudo fica guardado e entra no relatório e no assistente.
        </m.p>
      </section>

      <section className="data-paths" aria-label="Fontes de dados">
        <ImagesCard />
        <SensorCard pipeline={pipeline} />
      </section>

      <ImportPanel pipeline={pipeline} />
      {ds && data && <MonthlyHeat data={data} />}

      {ds && (
        <section className="data-split">
          <div>
            <h2>Dados guardados</h2>
            <m.ul className="db-list" variants={list} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-10%" }}>
              {(db?.stations ?? []).map((s) => (
                <m.li key={s.id} variants={item}>
                  <span className="db-name">{s.name}</span>
                  <span className="db-count">{fmt(s.readings)}</span>
                  <span className="db-meta">
                    código {s.id}, {STATION_TYPE_LABEL[s.type]?.toLowerCase() ?? s.type}, {fmt(s.readings_per_day, 1)} leituras por dia, de {day(s.first_reading)} a {day(s.last_reading)}
                  </span>
                </m.li>
              ))}
            </m.ul>
            {!db?.stations.length && <p className="empty">Nenhuma leitura guardada. Importe uma planilha acima.</p>}
          </div>
          <RunHistory />
        </section>
      )}
    </>
  );
}

/** Resumo do caminho por imagens, com atalho para enviar. */
function ImagesCard() {
  const confirmed = useImages(undefined, "confirmado").data ?? [];
  const pending = useImages(undefined, "pendente").data ?? [];
  const points = usePoints().data ?? [];
  const spots = new Set(confirmed.map((o) => o.station_id)).size;
  return (
    <div className="path-card">
      <h2>Imagens</h2>
      <p>
        {confirmed.length
          ? `${plural(confirmed.length, "observação confirmada", "observações confirmadas")} em ${plural(spots, "ponto", "pontos")}.`
          : "Nenhuma observação confirmada ainda."}
        {pending.length > 0 && ` ${plural(pending.length, "imagem espera", "imagens esperam")} a sua conferência.`}
        {!confirmed.length && !pending.length && points.length === 0 && " Envie uma foto da água ou uma imagem de satélite."}
      </p>
      <Link className="button-link" to="/imagens">{pending.length ? "Conferir imagens" : "Enviar uma imagem"}</Link>
    </div>
  );
}

/** Resumo do caminho por planilha de sensores, com atualizar e apagar. */
function SensorCard({ pipeline }: { pipeline: Pipeline }) {
  const db = useDbSummary().data;
  const ds = db?.dataset;
  const t = db?.totals;
  const running = !!pipeline.data?.running;
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clear = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    try {
      await clearSensorData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível apagar os dados.");
    }
  };

  return (
    <div className="path-card">
      <h2>Planilha de sensores</h2>
      {ds && t?.measurements ? (
        <>
          <p>
            {ds.name ?? "Conjunto importado"}: {plural(t.measurements, "leitura", "leituras")} de {plural(t.stations, "estação", "estações")}, de {day(t.first_reading)} a {day(t.last_reading)}.
            Já foram feitas {plural(t.runs, "análise", "análises")}.
          </p>
          <div className="path-actions">
            <Link className="button-link" to="/atualizar">Atualizar a análise</Link>
            <button type="button" className="text-button note-remove" onClick={clear} onBlur={() => setConfirming(false)} disabled={running}>
              {confirming ? "Confirmar: apagar os dados de sensores" : "Apagar dados de sensores"}
            </button>
          </div>
          <p className="field-hint">Apagar não remove as imagens, as anotações nem as conversas.</p>
        </>
      ) : (
        <p>Nenhuma planilha importada. Use o formulário abaixo para trazer leituras de sensores contínuos.</p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
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
        <h2 id="import-title">Importar planilha de sensores <span className="optional">opcional</span></h2>
        <p>
          Envie uma planilha CSV com as leituras dos seus sensores. Ela substitui o conjunto atual e a análise é refeita sozinha.
        </p>
        <ul className="format">
          <li><strong>Leituras (obrigatória):</strong> uma linha por medição, com data e hora, o código da estação e as medidas que você tiver.</li>
          <li>Funciona com planilhas do Excel salvas como CSV, com separador ponto e vírgula, vírgula decimal e datas como 31/12/2025 14:30.</li>
          <li>Cada dia precisa de pelo menos 6 leituras, como as de sensores contínuos. Coletas mensais de laboratório não bastam.</li>
        </ul>
        <div className="template-links">
          <button type="button" className="text-button" onClick={() => downloadText("modelo-leituras.csv", READINGS_TEMPLATE)}>Baixar planilha modelo de leituras</button>
          <button type="button" className="text-button" onClick={() => downloadText("modelo-estacoes.csv", STATIONS_TEMPLATE)}>Baixar planilha modelo de estações</button>
        </div>
        <HowItWorks label="Nomes das colunas">
          <p>
            Obrigatórias: <code>timestamp</code> e <code>station_id</code>. Medidas: <code>ph</code>, <code>do_mgl</code>, <code>temp_c</code>,{" "}
            <code>turbidity_ntu</code>, <code>conductivity_uscm</code>, <code>nitrate_mgl</code>, <code>phosphorus_mgl</code>, <code>coliforms_nmp</code>.
            Cabeçalhos como “Data/Hora”, “Estação”, “OD (mg/L)” ou “Fósforo total” também são reconhecidos, e valores abaixo do limite de
            detecção (por exemplo, <code>&lt;0,02</code>) entram como metade do limite.
          </p>
        </HowItWorks>
      </div>
      <form ref={form} className="import-form" onSubmit={submit}>
        <label className="file-field">
          <span>Leituras <em>obrigatório</em></span>
          <input type="file" name="measurements" accept=".csv,text/csv" required />
        </label>
        <label className="file-field">
          <span>Estações <em>opcional: código, nome, tipo, latitude e longitude</em></span>
          <input type="file" name="stations" accept=".csv,text/csv" />
        </label>
        <label className="file-field">
          <span>Eventos conhecidos <em>opcional: ocorrências já registradas, para avaliar a IA</em></span>
          <input type="file" name="events" accept=".csv,text/csv" />
        </label>
        <label className="file-field">
          <span>Nome do conjunto <em>ex.: Rede municipal, 2025</em></span>
          <input type="text" name="name" placeholder="Nome para identificar estes dados" />
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
        <span>Oxigênio dissolvido {fmt(r.do_mean, 1)} mg/L, fósforo {fmt(r.phosphorus_mean, 3)} mg/L.</span>
        <span>{r.anomaly_days} de {r.days} dias fora do padrão segundo a IA.</span>
      </>,
      e,
    );

  return (
    <section className="data-block" aria-labelledby="heat-title">
      <div className="block-head">
        <h2 id="heat-title">IQA mês a mês</h2>
        <p>
          Média mensal do IQA de cada estação. Passe o mouse sobre um mês para ver o pior dia e os dias fora do padrão.
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
        <p className="empty">Ainda não há série diária. Atualize a análise ou importe seus dados.</p>
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
              {r.accuracy != null && `, acerto da IA ${fmt(r.accuracy * 100)}%`}
            </span>
          </m.li>
        ))}
      </m.ol>
      {!runs.length && <p className="empty">Nenhuma análise ainda.</p>}
    </div>
  );
}
