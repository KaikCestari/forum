import { Link } from "react-router";
import { useImages, usePoints } from "../api/client";
import { attentionOf, KIND_LABEL } from "../lib/images";
import { dmy, plural } from "../lib/format";
import { useStationNames } from "../lib/useStationNames";

/** Primeira tela quando ainda não há dados de sensores: mostra os caminhos para trazer dados e os pontos já monitorados por imagem. */
export default function WelcomeView() {
  const confirmed = useImages(undefined, "confirmado").data ?? [];
  const pending = useImages(undefined, "pendente").data ?? [];
  const points = usePoints().data ?? [];
  const names = useStationNames();
  const byPoint = new Map<string, typeof confirmed>();
  confirmed.forEach((o) => byPoint.set(o.station_id, [...(byPoint.get(o.station_id) ?? []), o]));

  return (
    <article className="welcome">
      <header>
        <h1>Bem-vindo ao AquaML</h1>
        <p className="lede">Traga seus dados do jeito que você tem: uma foto da água, uma imagem de satélite ou uma planilha de sensores.</p>
      </header>

      <ul className="welcome-paths">
        <li>
          <Link to="/imagens">
            <strong>Enviar uma imagem</strong>
            <span>Foto da água ou imagem de satélite. A IA descreve o que enxerga e você confirma.</span>
          </Link>
        </li>
        <li>
          <Link to="/dados">
            <strong>Importar uma planilha</strong>
            <span>Leituras de sensores contínuos geram o IQA, os gráficos e as tendências.</span>
          </Link>
        </li>
        <li>
          <Link to="/guia">
            <strong>Conhecer o guia</strong>
            <span>Como ler o IQA, os limites legais e o que cada medida significa.</span>
          </Link>
        </li>
      </ul>

      {pending.length > 0 && (
        <p className="welcome-pending" role="status">
          <Link className="inline-link" to="/imagens">{plural(pending.length, "imagem espera", "imagens esperam")} a sua conferência.</Link>
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
                    {last ? `${plural(obs.length, "observação", "observações")}, a última em ${dmy(last.observed_on)} (${KIND_LABEL[last.kind].toLowerCase()})` : "Nenhuma observação confirmada"}
                  </span>
                  {last && <span className="attention-chip" style={{ ["--c" as string]: attentionOf(last.analysis).color }}>{attentionOf(last.analysis).label}</span>}
                  <Link className="inline-link" to={`/imagens?ponto=${encodeURIComponent(p.id)}`}>Enviar imagem</Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </article>
  );
}
