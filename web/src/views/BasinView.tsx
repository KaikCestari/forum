import { m } from "motion/react";
import { useMemo } from "react";
import { Link } from "react-router";
import type { Overview } from "../api/types";
import { BasinMap } from "../components/BasinMap";
import { Timeline } from "../components/Timeline";
import { SEVERITY, basinHeadline, basinLede, isLongTerm } from "../lib/domain";
import { dateRange } from "../lib/format";
import { ease, item, list } from "../motion/tokens";

export default function BasinView({ data }: { data: Overview }) {
  const attention = useMemo(() => data.alerts.filter((a) => !isLongTerm(a)).slice(0, 4), [data.alerts]);

  return (
    <>
      <section className="basin" aria-labelledby="basin-title">
        <div className="basin-text">
          <m.h1 id="basin-title" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: ease.out, delay: 0.1 }}>
            {basinHeadline(data.stations)}
          </m.h1>
          <m.p className="lede" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: ease.out, delay: 0.22 }}>
            {basinLede(data)}
          </m.p>
        </div>
        <figure className="basin-figure">
          <BasinMap data={data} />
          <figcaption>
            Esquema ilustrativo da bacia, da nascente ao oceano. A cor de cada estação é a classe do IQA nos últimos 30 dias. Clique numa estação para abri-la.
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
                    <strong>{a.title}</strong> em {a.station_name}
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
          <h2 id="timeline-title">Dois anos de monitoramento</h2>
          <p>
            Cada faixa é uma estação. Marcas coloridas são alertas, pontos são dias que a IA achou anormais e as áreas claras são os
            eventos conhecidos. Clique numa marca para ver o dia no gráfico.
          </p>
        </div>
        <Timeline data={data} />
        <ul className="legend" aria-label="Legenda">
          {(["critico", "alto", "atencao"] as const).map((k) => (
            <li key={k}><i style={{ background: SEVERITY[k].color }} />Alerta {SEVERITY[k].label.toLowerCase()}</li>
          ))}
          <li><i className="dot" style={{ background: "var(--accent)" }} />Anomalia detectada pela IA</li>
          <li><i style={{ background: "var(--water-light)" }} />Evento conhecido</li>
        </ul>
      </section>
    </>
  );
}
