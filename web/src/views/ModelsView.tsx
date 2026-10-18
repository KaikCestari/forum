import { AnimatePresence, m } from "motion/react";
import { useMemo, useState } from "react";
import type { Overview } from "../api/types";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { CLUSTER_COLORS, ClusterScatter } from "../components/ClusterScatter";
import { Sparkline } from "../components/Sparkline";
import { trendTone, verdictLabel } from "../lib/domain";
import { dateRange, fmt } from "../lib/format";
import { ease, item, list, spring } from "../motion/tokens";

export default function ModelsView({ data }: { data: Overview }) {
  return (
    <>
      <AnomalySection data={data} />
      <ClassifierSection data={data} />
      <ClusterSection data={data} />
      <TrendSection data={data} />
    </>
  );
}

const reveal = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-10%" },
  transition: { duration: 0.7, ease: ease.out },
};

function AnomalySection({ data }: { data: Overview }) {
  const ev = data.anomalies.evaluation;
  const names = useMemo(() => new Map(data.stations.map((s) => [s.id, s.name])), [data.stations]);
  if (!ev) return <EpisodeSection data={data} names={names} />;
  const hits = ev.events.filter((e) => e.detected).length;

  return (
    <section className="model model-anomaly" aria-labelledby="anomaly-title">
      <div className="model-claim">
        <p className="huge" aria-hidden="true">
          <AnimatedNumber value={hits} /><span className="huge-of">/{ev.events.length}</span>
        </p>
        <m.h1 id="anomaly-title" {...reveal}>eventos encontrados pela IA</m.h1>
        <m.p {...reveal} transition={{ ...reveal.transition, delay: 0.1 }}>
          O Isolation Forest não sabe onde estão os eventos plantados nos dados. Ele aprende o comportamento normal de cada estação e
          marca o que foge dele. {fmt(ev.day_precision * 100)}% dos dias marcados caem dentro de um evento. Os outros são, em geral,
          chuvas fortes, que também mudam a água de verdade.
        </m.p>
      </div>
      <m.ul className="event-list" variants={list} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-10%" }}>
        {ev.events.map((e) => (
          <m.li key={`${e.station_id}-${e.start}`} variants={item}>
            <span className="event-name">{e.description}</span>
            <span className={`event-hit ${e.detected ? "" : "is-miss"}`}>{e.detected ? "Encontrado" : "Não encontrado"}</span>
            <span className="event-meta">{names.get(e.station_id)}, {dateRange(e.start, e.end)}</span>
          </m.li>
        ))}
      </m.ul>
    </section>
  );
}

/** Dados reais costumam vir sem eventos rotulados: mostra o que a IA encontrou sozinha. */
function EpisodeSection({ data, names }: { data: Overview; names: Map<string, string> }) {
  const episodes = useMemo(() => data.anomalies.episodes.toSorted((a, b) => b.start.localeCompare(a.start)), [data.anomalies.episodes]);

  return (
    <section className="model model-anomaly" aria-labelledby="anomaly-title">
      <div className="model-claim">
        <p className="huge" aria-hidden="true"><AnimatedNumber value={episodes.length} /></p>
        <m.h1 id="anomaly-title" {...reveal}>episódios anormais encontrados pela IA</m.h1>
        <m.p {...reveal} transition={{ ...reveal.transition, delay: 0.1 }}>
          Sem eventos rotulados para conferir, o Isolation Forest aprende o comportamento normal de cada estação e marca os dias que
          fogem dele. Ao lado estão os mais recentes; vale confirmar cada um com coleta de campo.
        </m.p>
      </div>
      {episodes.length ? (
        <m.ul className="event-list" variants={list} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-10%" }}>
          {episodes.slice(0, 8).map((e) => (
            <m.li key={`${e.station_id}-${e.start}`} variants={item}>
              <span className="event-name">{names.get(e.station_id) ?? e.station_id}</span>
              <span className="event-hit">{e.days === 1 ? "1 dia" : `${e.days} dias`}</span>
              <span className="event-meta">
                {dateRange(e.start, e.end)}
                {e.params.length ? `, ${e.params.map((p) => data.parameters[p]?.label.toLowerCase() ?? p).join(", ")}` : ""}
              </span>
            </m.li>
          ))}
        </m.ul>
      ) : (
        <p className="empty">Nenhum episódio anormal no período.</p>
      )}
    </section>
  );
}

function ClassifierSection({ data }: { data: Overview }) {
  const c = data.classification;
  const maxImp = Math.max(...c.feature_importance.map((f) => f.importance));

  return (
    <section className="model model-classifier" aria-labelledby="clf-title">
      <div className="model-claim">
        <p className="huge" aria-hidden="true"><AnimatedNumber value={c.accuracy * 100} />%</p>
        <m.h2 id="clf-title" {...reveal}>de acerto na classe da água</m.h2>
        <m.p {...reveal} transition={{ ...reveal.transition, delay: 0.1 }}>
          Um Random Forest treinado com {fmt(c.n_train)} dias aprendeu a reconhecer a classe do IQA direto das leituras dos sensores.
          Testado em {fmt(c.n_test)} dias que nunca viu, ele acerta {fmt(c.accuracy * 100)}% das vezes e ainda{" "}
          {fmt(c.accuracy_one_sensor_missing * 100)}% com um sensor desligado.
        </m.p>
      </div>
      <div className="model-detail">
        <h3>O que mais pesa na decisão</h3>
        <m.ul className="bars" variants={list} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-10%" }}>
          {c.feature_importance.map((f) => (
            <m.li key={f.feature} className="bar-row" variants={item}>
              <span>{data.parameters[f.feature]?.label ?? f.feature}</span>
              <span className="bar-track">
                <m.span
                  className="bar-fill"
                  style={{ originX: 0 }}
                  variants={{ hidden: { scaleX: 0 }, show: { scaleX: f.importance / maxImp, transition: { duration: 1, ease: ease.out } } }}
                />
              </span>
              <span className="bar-pct">{fmt(f.importance * 100)}%</span>
            </m.li>
          ))}
        </m.ul>
        <h3>Onde o modelo acerta e onde erra</h3>
        <div className="table-wrap">
          <table className="confusion">
            <thead>
              <tr>
                <th scope="col">Real, previsto</th>
                {c.labels.map((l) => <th key={l} scope="col">{l}</th>)}
              </tr>
            </thead>
            <m.tbody variants={list} initial="hidden" whileInView="show" viewport={{ once: true }}>
              {c.confusion_matrix.map((row, i) => {
                const total = row.reduce((a, b) => a + b, 0) || 1;
                return (
                  <tr key={c.labels[i]}>
                    <th scope="row">{c.labels[i]}</th>
                    {row.map((v, j) => {
                      const share = v / total;
                      return (
                        <m.td
                          key={j}
                          variants={{ hidden: { opacity: 0, scale: 0.8 }, show: { opacity: 1, scale: 1, transition: spring.settle } }}
                          style={{
                            background: `color-mix(in oklab, var(--series-1) ${Math.round(share * 90)}%, var(--tone-2))`,
                            color: share > 0.5 ? "#fff" : "var(--ink)",
                          }}
                          title={`${v} de ${total} dias`}
                        >
                          {v}
                        </m.td>
                      );
                    })}
                  </tr>
                );
              })}
            </m.tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ClusterSection({ data }: { data: Overview }) {
  const [active, setActive] = useState<number | null>(null);
  const names = useMemo(() => new Map(data.stations.map((s) => [s.id, s.name])), [data.stations]);
  const c = data.clusters;

  return (
    <section className="model model-clusters" aria-labelledby="cluster-title">
      <div className="model-claim">
        <m.h2 id="cluster-title" {...reveal}>Três perfis de ecossistema</m.h2>
        <m.p {...reveal} transition={{ ...reveal.transition, delay: 0.1 }}>
          O K-Means agrupou {c.points.length} meses de todas as estações pelo que a água tinha em comum, sem saber de onde vinha cada
          mês. Os grupos se separaram sozinhos pelo grau de impacto humano. Passe o mouse num perfil para destacá-lo.
        </m.p>
        <ul className="profiles" onPointerLeave={() => setActive(null)}>
          {c.profiles.map((p) => (
            <li key={p.cluster}>
              <button
                type="button"
                className={`profile ${active === p.cluster ? "is-active" : ""}`}
                onPointerEnter={() => setActive(p.cluster)}
                onFocus={() => setActive(p.cluster)}
                onBlur={() => setActive(null)}
                aria-pressed={active === p.cluster}
              >
                <i style={{ background: CLUSTER_COLORS[p.cluster] }} />
                <strong>{p.label}</strong>
                <span>IQA médio de {fmt(p.mean.iqa)} em {p.stations.map((s) => names.get(s)).join(", ")}.</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <ClusterScatter clusters={c} stations={data.stations} active={active} />
    </section>
  );
}

function TrendSection({ data }: { data: Overview }) {
  const [showStable, setShowStable] = useState(false);
  const names = useMemo(() => new Map(data.stations.map((s) => [s.id, s.name])), [data.stations]);
  const trends = useMemo(
    () => data.trends
      .filter((t) => showStable || t.significant)
      .toSorted((a, b) => Number(b.significant) - Number(a.significant) || Math.abs(b.pct_per_year) - Math.abs(a.pct_per_year)),
    [data.trends, showStable],
  );

  return (
    <section className="model model-trends" aria-labelledby="trend-title">
      <div className="block-head">
        <h2 id="trend-title">Tendências de longo prazo</h2>
        <label className="toggle">
          <input type="checkbox" checked={showStable} onChange={(e) => setShowStable(e.target.checked)} />
          Mostrar também os estáveis
        </label>
      </div>
      <p className="block-intro">
        Teste de Mann-Kendall sazonal. Ele compara cada mês com o mesmo mês do ano seguinte, para não confundir a estação do ano com
        mudança real.
      </p>
      <m.ul className="trend-grid" layout>
        <AnimatePresence initial={false} mode="popLayout">
          {trends.map((t, i) => (
            <m.li
              key={`${t.station_id}-${t.parameter}`}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1, transition: { duration: 0.35, ease: ease.out, delay: Math.min(i, 16) * 0.02 } }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
              style={{ ["--tone" as string]: trendTone(t) }}
            >
              <span className="trend-value">{t.pct_per_year > 0 ? "+" : ""}{fmt(t.pct_per_year)}% ao ano</span>
              <span className="trend-name">{t.label} em {names.get(t.station_id)}</span>
              <span className="trend-desc">
                {t.significant ? `${verdictLabel(t)} significativa (p = ${fmt(t.p_value, 3)})` : `Estável (p = ${fmt(t.p_value, 2)})`}
              </span>
              <Sparkline values={t.monthly.map((x) => x.value)} width={120} height={48} color="var(--tone)" strokeWidth={2} delay={0.2} />
            </m.li>
          ))}
        </AnimatePresence>
      </m.ul>
    </section>
  );
}
