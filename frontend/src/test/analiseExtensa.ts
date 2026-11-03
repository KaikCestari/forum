import type { ResultadoAnalise } from '../api/tipos';
import { criarAnaliseParcial } from './analiseParcial';

export function criarAnaliseExtensa(): ResultadoAnalise {
  const analise = criarAnaliseParcial();
  const dia = (indice: number) =>
    new Date(Date.UTC(2024, 0, 1 + indice)).toISOString().slice(0, 10);
  analise.period = { start: '2024-01-01', end: '2025-12-31' };
  analise.stations = Array.from({ length: 6 }, (_, i) => ({
    ...analise.stations[0],
    stationId: `estacao-${i + 1}`,
    name: `Estação ${i + 1}`,
  }));
  const estacao = (indice: number) => analise.stations[indice % 6].stationId;
  analise.alerts = Array.from({ length: 157 }, (_, i) => ({
    stationId: estacao(i),
    date: dia(i),
    parameter: 'doMgl',
    value: 3,
    unit: 'mg/L',
    severity: i % 2 ? 'critico' : 'atencao',
    message: `Alerta ${i + 1}`,
  }));
  analise.anomalies.episodes = Array.from({ length: 91 }, (_, i) => ({
    stationId: estacao(i),
    start: dia(i),
    end: dia(i + 2),
    days: 3,
    maxScore: null,
    parameters: ['doMgl'],
  }));
  analise.anomalies.evaluation = { knownEvents: 12, detected: 9, recall: 0.75 };
  analise.classification.accuracy = 0.91;
  analise.classification.current = Object.fromEntries(
    analise.stations.map((e) => [e.stationId, 'Boa']),
  );
  analise.clusters.points = Array.from({ length: 4340 }, (_, i) => ({
    stationId: estacao(i),
    date: dia(Math.floor(i / 6)),
    cluster: i % 3,
    x: Math.sin(i * 0.7) + (i % 3) * 2,
    y: Math.cos(i * 1.3) + (i % 3),
  }));
  analise.clusters.profiles = Array.from({ length: 3 }, (_, i) => ({
    cluster: i,
    label: `Perfil ${i}`,
    size: analise.clusters.points.filter((p) => p.cluster === i).length,
    means: { doMgl: 5 + i },
  }));
  analise.trends = Array.from({ length: 36 }, (_, i) => ({
    stationId: estacao(i),
    parameter: Object.keys(analise.parameters)[Math.floor(i / 6)],
    direction: i % 3 === 0 ? 'piora' : i % 3 === 1 ? 'melhora' : 'estavel',
    slopePerYear: 0.1,
    pValue: 0.03,
  }));
  return analise;
}
