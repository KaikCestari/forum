// Filtra registros por estação sem recalcular a avaliação dos modelos ou os perfis globais.
import type { ResultadoAnalise } from '../../api/tipos';

export function filtrarAnalise(analise: ResultadoAnalise, estacao: string): ResultadoAnalise {
  if (!estacao) return analise;
  const pertence = (registro: { stationId: string }) => registro.stationId === estacao;
  const pontos = analise.clusters.points.filter(pertence);
  const grupos = new Set(pontos.map((ponto) => ponto.cluster));
  return {
    ...analise,
    stations: analise.stations.filter(pertence),
    alerts: analise.alerts.filter(pertence),
    anomalies: { ...analise.anomalies, episodes: analise.anomalies.episodes.filter(pertence) },
    classification: {
      ...analise.classification,
      current: Object.fromEntries(
        Object.entries(analise.classification.current).filter(([id]) => id === estacao),
      ),
    },
    clusters: {
      ...analise.clusters,
      points: pontos,
      profiles: analise.clusters.profiles.filter((perfil) => grupos.has(perfil.cluster)),
    },
    trends: analise.trends.filter(pertence),
  };
}
