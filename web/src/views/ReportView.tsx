import { useMemo } from "react";
import { Link } from "react-router";
import { apiUrl, useDbSummary, useImages, useNotes, useSeries } from "../api/client";
import type { Overview, Station } from "../api/types";
import { NOTE_KIND } from "../components/NotesPanel";
import { KIND_LABEL, attentionOf, signals } from "../lib/images";
import { useStationNames } from "../lib/useStationNames";
import { IQA_COLOR, SEVERITY, daysOutside, iqaClass, isLongTerm, limitFor, riverOrder, trendTone, verdictLabel } from "../lib/domain";
import { csvLine, downloadText } from "../lib/export";
import { dateRange, dayDiff, dmy, fmt } from "../lib/format";
import { STATION_TYPE_LABEL } from "../lib/guide";

const CHECKED = ["do_mgl", "coliforms_nmp", "nitrate_mgl", "turbidity_ntu", "phosphorus_mgl", "ph"] as const;

export default function ReportView({ data }: { data?: Overview }) {
  const db = useDbSummary().data;
  const real = db?.dataset?.source === "real";
  const notes = (useNotes().data ?? []).slice(0, 10);
  const images = (useImages(undefined, "confirmado").data ?? []).slice(0, 12);
  const names = useStationNames();
  const stations = useMemo(() => (data ? riverOrder(data.stations, real) : []), [data, real]);
  const attention = useMemo(
    () => (data?.alerts ?? []).filter((a) => !isLongTerm(a) && dayDiff(a.end, data!.period[1]) <= 90).slice(0, 8),
    [data],
  );
  const trends = useMemo(() => (data?.trends ?? []).filter((t) => t.significant && t.verdict !== "estável"), [data]);
  const origin = real ? `Dados reais: ${db?.dataset?.name ?? "conjunto importado"}` : "";

  const downloadSummary = () => {
    if (!data) return;
    const head = ["Estação", "Tipo", "IQA (30 dias)", "Classe", "IQA médio do período", "Alertas nos últimos 30 dias", "Alertas críticos no período", "Tendências de piora"];
    const rows = stations.map((s) => [
      s.name, STATION_TYPE_LABEL[s.type] ?? s.type, Math.round(s.iqa_30d), iqaClass(s.iqa_30d), Math.round(s.iqa_period),
      s.alerts_recent, s.critical_total, s.worsening_trends.join(", "),
    ]);
    downloadText(`resumo-da-bacia-${data.period[1]}.csv`, [csvLine(head), ...rows.map(csvLine)].join("\r\n"));
  };

  return (
    <article className="report">
      <header className="report-head">
        <div>
          <h1>Relatório da bacia</h1>
          <p className="lede">
            {data ? `Período analisado: ${dmy(data.period[0])} a ${dmy(data.period[1])}. ` : "Observações por imagem e anotações de campo. "}
            {origin ? `${origin}. ` : ""}Gerado em {new Date().toLocaleDateString("pt-BR")}.
          </p>
        </div>
        <div className="report-actions no-print">
          <button type="button" className="button" onClick={() => window.print()}>Imprimir ou salvar em PDF</button>
          {data && <button type="button" className="text-button" onClick={downloadSummary}>Baixar resumo em CSV</button>}
        </div>
      </header>

      {data && (
        <>
      <section className="report-block" aria-labelledby="rep-summary">
        <h2 id="rep-summary">Resumo</h2>
        <ul className="report-insights">
          {data.insights.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </section>

      <section className="report-block" aria-labelledby="rep-stations">
        <h2 id="rep-stations">Situação das estações</h2>
        <div className="table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th scope="col">Estação</th><th scope="col">Tipo</th><th scope="col">IQA (30 dias)</th><th scope="col">Classe</th>
                <th scope="col">Alertas no último mês</th><th scope="col">Piora contínua</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((s) => {
                const cls = iqaClass(s.iqa_30d)!;
                return (
                  <tr key={s.id}>
                    <th scope="row"><Link to={`/estacoes/${s.id}`} className="hn">{s.name}</Link></th>
                    <td>{STATION_TYPE_LABEL[s.type] ?? s.type}</td>
                    <td className="num">{fmt(s.iqa_30d)}</td>
                    <td><span className="class-dot" style={{ background: IQA_COLOR[cls] }} aria-hidden="true" />{cls}</td>
                    <td className="num">{s.alerts_recent}</td>
                    <td>{s.worsening_trends.length ? s.worsening_trends.join(", ") : "Não"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="report-block" aria-labelledby="rep-limits">
        <h2 id="rep-limits">Limites legais nos últimos 30 dias</h2>
        <p className="block-intro">Dias em que cada medida ficou fora do limite da CONAMA 357/2005 (classe 2). Zero é o desejável.</p>
        <div className="table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th scope="col">Estação</th>
                {CHECKED.map((p) => <th key={p} scope="col">{data.parameters[p]?.label ?? p}</th>)}
              </tr>
            </thead>
            <tbody>
              {stations.map((s) => <LimitsRow key={s.id} station={s} />)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="report-block" aria-labelledby="rep-attention">
        <h2 id="rep-attention">O que pede atenção</h2>
        {attention.length ? (
          <ul className="report-alerts">
            {attention.map((a) => (
              <li key={a.id} style={{ ["--sev" as string]: SEVERITY[a.severity].color }}>
                <span className="alert-sev"><i />{SEVERITY[a.severity].label}</span>
                <div>
                  <strong>{a.title}</strong> em <span className="hn">{a.station_name}</span>, {dateRange(a.start, a.end)}
                  <p>{a.message}</p>
                  <p className="alert-rec">{a.recommendation}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Nada pede atenção nos últimos 90 dias.</p>
        )}
      </section>

      <section className="report-block" aria-labelledby="rep-trends">
        <h2 id="rep-trends">Tendências confirmadas</h2>
        {trends.length ? (
          <ul className="report-trends">
            {trends.map((t) => (
              <li key={`${t.station_id}-${t.parameter}`} style={{ ["--tone" as string]: trendTone(t) }}>
                <strong className="trend-value">{verdictLabel(t)}</strong> de {t.label.toLowerCase()} em{" "}
                <span className="hn">{names.get(t.station_id) ?? t.station_id}</span>: {t.pct_per_year > 0 ? "+" : ""}{fmt(t.pct_per_year)}% ao ano.
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Nenhuma medida mudou de forma contínua no período.</p>
        )}
      </section>

        </>
      )}

      <section className="report-block" aria-labelledby="rep-images">
        <h2 id="rep-images">Observações por imagem</h2>
        {images.length ? (
          <ul className="report-images">
            {images.map((o) => {
              const att = attentionOf(o.analysis);
              return (
                <li key={o.id}>
                  <img src={apiUrl(o.file_url)} alt={`${KIND_LABEL[o.kind]} de ${names.get(o.station_id) ?? o.station_id}`} loading="lazy" />
                  <div>
                    <p className="obs-head">
                      <span className="hn">{names.get(o.station_id) ?? o.station_id}</span>
                      <span className="obs-date">{dmy(o.observed_on)}</span>
                      <span className="obs-kind">{KIND_LABEL[o.kind]}</span>
                      <span className="attention-chip" style={{ ["--c" as string]: att.color }}>{att.label}</span>
                    </p>
                    {o.analysis.resumo && <p>{o.analysis.resumo}</p>}
                    {signals(o.analysis).length > 0 && <p className="report-signals">{signals(o.analysis).join(", ")}.</p>}
                    {o.analysis.o_que_conferir_em_campo && <p className="alert-rec">{o.analysis.o_que_conferir_em_campo}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty">Nenhuma observação por imagem confirmada. Envie imagens na seção Imagens.</p>
        )}
      </section>

      <section className="report-block" aria-labelledby="rep-notes">
        <h2 id="rep-notes">Anotações de campo recentes</h2>
        {notes.length ? (
          <ul className="report-notes">
            {notes.map((n) => (
              <li key={n.id}>
                <span className={`note-kind is-${n.kind}`}>{NOTE_KIND[n.kind] ?? n.kind}</span>
                <span className="note-date">{dmy(n.noted_on)}</span>
                <span className="hn">{names.get(n.station_id) ?? n.station_id}</span>
                <p>{n.text}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Nenhuma anotação no caderno de campo. Registre-as na página de cada estação.</p>
        )}
      </section>

      <p className="report-foot">
        Os limites seguem a Resolução CONAMA 357/2005 (classe 2) e o IQA segue as faixas da CETESB. Este relatório apoia a decisão, mas
        não substitui a confirmação em campo.
      </p>
    </article>
  );
}

function LimitsRow({ station }: { station: Station }) {
  const series = useSeries(station.id).data;
  return (
    <tr>
      <th scope="row"><span className="hn">{station.name}</span></th>
      {CHECKED.map((p) => {
        if (!series) return <td key={p} className="num">…</td>;
        const n = daysOutside(series[p] ?? [], limitFor(p, station.type));
        return <td key={p} className={`num ${n ? "is-bad" : "is-ok"}`}>{n ? `${n} ${n === 1 ? "dia" : "dias"}` : "0"}</td>;
      })}
    </tr>
  );
}
