import { m } from "motion/react";
import { useMemo } from "react";
import { Link } from "react-router";
import { useDbSummary } from "../api/client";
import type { Overview } from "../api/types";
import { BasinMap } from "../components/BasinMap";
import { Timeline } from "../components/Timeline";
import { SEVERITY, basinHeadline, basinLede, isLongTerm } from "../lib/domain";
import { dateRange, periodLength } from "../lib/format";
import { ease, item, list } from "../motion/tokens";

export default function BasinView({ data }: { data: Overview }) {
  const attention = useMemo(() => data.alerts.filter((a) => !isLongTerm(a)).slice(0, 4), [data.alerts]);
  const real = useDbSummary().data?.dataset?.source === "real";

  return (
    <>
      <section className="basin" aria-labelledby="basin-title">
        <div className="basin-text">
          <m.h1 id="basin-title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: ease.out, delay: 0.1 }}>
            {basinHeadline(data.stations)}
          </m.h1>
          <m.p className="lede" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: ease.out, delay: 0.22 }}>
            {basinLede(data)}
          </m.p>
        </div>
        <figure className="basin-figure">
          <BasinMap data={data} />
          <figcaption>
            {real
              ? "Estações de oeste para leste, pela longitude quando informada; o traçado do rio é só ilustrativo."
              : "Esquema ilustrativo da bacia, da nascente ao oceano."}{" "}
            A cor de cada estação é a classe do IQA (Índice de Qualidade da Água, de 0 a 100) nos últimos 30 dias. Clique numa estação
            para abri-la. <Link to="/guia" className="inline-link">Entenda o IQA</Link>
          </figcaption>
        </figure>
      </section>

      <section className="attention" aria-labelledby="attention-title">
        <h2 id="attention-title">O que pede atenção</h2>
        {attention.length ? (
          <m.ul className="attention-list" variants={list} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-10%" }}>
            {attention.map((a) => (
              <m.li key={a.id} variants={item}>
                <Link to={`/estacoes/${a.station_id}?dia=${a.start}`} className="attention-item" style={{ ["--sev" as string]: SEVERITY[a.severity].color }}>
                  <span className="attention-swatch" aria-hidden="true" />
                  <span className="attention-title">
                    <strong>{a.title}</strong> em <i className="hn">{a.station_name}</i>
                  </span>
                  <span className="attention-meta">
                    {SEVERITY[a.severity].label}, {dateRange(a.start, a.end)}
                    {a.days && a.days > 1 ? `, ${a.days} dias` : ""}
                  </span>
                </Link>
              </m.li>
            ))}
          </m.ul>
        ) : (
          <p className="empty">Nada pede atenção agora. Todos os episódios recentes foram resolvidos.</p>
        )}
      </section>

      <section className="timeline-block" aria-labelledby="timeline-title">
        <div className="block-head">
          <h2 id="timeline-title">{periodLength(data.period[0], data.period[1])} de monitoramento</h2>
          <p>
            Cada faixa é uma estação. As marcas coloridas são alertas, os pontos magenta são dias fora do padrão segundo a IA e as áreas
            claras são eventos conhecidos. Clique numa marca para ver o dia no gráfico.
          </p>
        </div>
        <Timeline data={data} />
        <ul className="legend" aria-label="Legenda">
          {(["critico", "alto", "atencao"] as const).map((k) => (
            <li key={k}><i style={{ background: SEVERITY[k].color }} />Alerta {SEVERITY[k].label.toLowerCase()}</li>
          ))}
          <li><i className="dot" style={{ background: "var(--ai)" }} />Dia fora do padrão (IA)</li>
          <li><i style={{ background: "var(--water-light)" }} />Evento conhecido</li>
        </ul>
      </section>
    </>
  );
}
