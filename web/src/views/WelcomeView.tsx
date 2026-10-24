import { Link } from "react-router";
import { useImages, useOverview, usePoints } from "../api/client";
import { attentionOf, KIND_LABEL } from "../lib/images";
import { dmy, plural } from "../lib/format";
import { useStationNames } from "../lib/useStationNames";
import type { Overview } from "../api/types";
import { Icon, type IconName } from "../components/Icon";
import { WaterIllustration } from "../components/WaterIllustration";
import BasinView from "./BasinView";

/** Primeira tela quando ainda não há dados de sensores: mostra os caminhos para trazer dados e os pontos já monitorados por imagem. */
export default function WelcomeView({ data }: { data?: Overview }) {
  const confirmedRequest = useImages(undefined, "confirmado");
  const pendingRequest = useImages(undefined, "pendente");
  const pointsRequest = usePoints();
  const overview = useOverview();
  const confirmed = confirmedRequest.data ?? [];
  const pending = pendingRequest.data ?? [];
  const points = pointsRequest.data ?? [];
  const names = useStationNames();
  const byPoint = new Map<string, typeof confirmed>();
  confirmed.forEach((o) =>
    byPoint.set(o.station_id, [...(byPoint.get(o.station_id) ?? []), o]),
  );

  return (
    <article className="dashboard">
      <header className="page-heading dashboard-heading">
        <div>
          <h1>Visão geral</h1>
          <p>Acompanhe seus ecossistemas e encontre o próximo passo.</p>
        </div>
        <span className="workspace-badge">
          <Icon name="water" size={15} />
          Monitoramento aquático
        </span>
      </header>

      {!data && (
        <section className="dashboard-hero" aria-labelledby="start-title">
          <div className="hero-copy">
            <span className="hero-tag">
              <span />
              Do campo à análise
            </span>
            <h2 id="start-title">
              Um novo olhar para
              <br />a qualidade da água.
            </h2>
            <p>
              Reúna imagens e leituras de sensores. Transforme suas observações
              em informação para cuidar de cada ecossistema.
            </p>
            <div className="hero-actions">
              <Link className="hero-primary" to="/dados?aba=importar">
                <Icon name="upload" size={17} />
                Importar planilha
              </Link>
              <Link className="hero-secondary" to="/imagens?aba=enviar">
                <Icon name="image" size={17} />
                Enviar imagem
              </Link>
            </div>
          </div>
          <WaterIllustration />
        </section>
      )}

      <div className="dashboard-metrics" aria-label="Resumo do monitoramento">
        {(
          [
            {
              label: "Pontos monitorados",
              value: pointsRequest.data
                ? new Set([
                    ...points.map((p) => p.id),
                    ...(data?.stations.map((s) => s.id) ?? []),
                  ]).size
                : undefined,
              icon: "pin",
              detail: "Imagens e estações",
              to: "/caderno",
            },
            {
              label: "Imagens confirmadas",
              value: confirmedRequest.data?.length,
              icon: "image",
              detail: "Observações revisadas",
              to: "/imagens?aba=confirmadas",
            },
            {
              label: "Revisões pendentes",
              value: pendingRequest.data?.length,
              icon: "clock",
              detail: pending.length
                ? "Aguardando sua conferência"
                : "Imagens para conferir",
              to: "/imagens?aba=revisar",
            },
            {
              label: "Estações com sensores",
              value:
                data?.stations.length ??
                (overview.error?.status === 503 ? 0 : undefined),
              icon: "stations",
              detail: data
                ? "Com análise disponível"
                : "Importe leituras para começar",
              to: "/estacoes",
            },
          ] satisfies {
            label: string;
            value?: number;
            icon: IconName;
            detail: string;
            to: string;
          }[]
        ).map((metric) => (
          <Link className="metric" key={metric.label} to={metric.to}>
            <div className="metric-title">
              <span>{metric.label}</span>
              <Icon name={metric.icon} size={18} />
            </div>
            <strong>{metric.value ?? "—"}</strong>
            <span className="metric-detail">{metric.detail}</span>
          </Link>
        ))}
      </div>

      {data ? (
        <div className="dashboard-basin">
          <BasinView data={data} />
        </div>
      ) : (
        <div className="dashboard-columns">
          <section
            className="workspace-modules"
            aria-labelledby="modules-title"
          >
            <div className="block-head">
              <h2 id="modules-title">Seu espaço de monitoramento</h2>
              <span className="section-caption">Cada etapa, no seu lugar</span>
            </div>
            <div className="module-list">
              {(
                [
                  {
                    icon: "image",
                    to: "/imagens",
                    title: "Observações por imagem",
                    description:
                      "Envie fotos e imagens de satélite para analisar e revisar.",
                    color: "teal",
                  },
                  {
                    icon: "stations",
                    to: "/estacoes",
                    title: "Estações e qualidade da água",
                    description:
                      "Explore o IQA, os parâmetros e a evolução de cada estação.",
                    color: "blue",
                  },
                  {
                    icon: "assistant",
                    to: "/assistente",
                    title: "Assistente ambiental",
                    description:
                      "Tire dúvidas e investigue o que seus dados revelam.",
                    color: "violet",
                  },
                  {
                    icon: "notes",
                    to: "/caderno",
                    title: "Caderno de campo",
                    description:
                      "Registre coletas, ocorrências e observações por ponto.",
                    color: "ochre",
                  },
                ] satisfies {
                  icon: IconName;
                  to: string;
                  title: string;
                  description: string;
                  color: string;
                }[]
              ).map((module) => (
                <Link to={module.to} className="module-item" key={module.to}>
                  <span className={`module-icon is-${module.color}`}>
                    <Icon name={module.icon} size={22} />
                  </span>
                  <span>
                    <strong>{module.title}</strong>
                    <small>{module.description}</small>
                  </span>
                  <Icon name="chevron" size={16} />
                </Link>
              ))}
            </div>
          </section>
          <aside className="getting-started">
            <div className="getting-started-heading">
              <Icon name="guide" size={21} />
              <h2>Como começar</h2>
            </div>
            <ol className="setup-steps">
              <li>
                <span>1</span>
                <div>
                  <strong>Traga seus dados</strong>
                  <p>Uma imagem ou planilha já é um ponto de partida.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Explore a análise</strong>
                  <p>Veja indicadores, tendências e sinais de atenção.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Confirme em campo</strong>
                  <p>Revise os resultados e registre o que observou.</p>
                </div>
              </li>
            </ol>
            <Link className="guide-cta" to="/guia">
              Conhecer o guia
              <Icon name="arrow" size={17} />
            </Link>
          </aside>
        </div>
      )}

      {pending.length > 0 && (
        <p className="welcome-pending" role="status">
          <Link className="inline-link" to="/imagens?aba=revisar">
            {plural(pending.length, "imagem espera", "imagens esperam")} a sua
            conferência.
          </Link>
        </p>
      )}

      {points.length > 0 && (
        <section className="welcome-points" aria-labelledby="points-title">
          <h2 id="points-title">Pontos monitorados por imagem</h2>
          <ul className="point-list">
            {points.map((p) => {
              const obs = byPoint.get(p.id) ?? [];
              const last = obs[0];
              return (
                <li key={p.id}>
                  <span className="hn">{names.get(p.id) ?? p.name}</span>
                  <span className="point-meta">
                    {last
                      ? `${plural(obs.length, "observação", "observações")}, a última em ${dmy(last.observed_on)} (${KIND_LABEL[last.kind].toLowerCase()})`
                      : "Nenhuma observação confirmada"}
                  </span>
                  {last && (
                    <span
                      className="attention-chip"
                      style={{
                        ["--c" as string]: attentionOf(last.analysis).color,
                      }}
                    >
                      {attentionOf(last.analysis).label}
                    </span>
                  )}
                  <Link
                    className="inline-link"
                    to={`/imagens?ponto=${encodeURIComponent(p.id)}`}
                  >
                    Enviar imagem
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </article>
  );
}
