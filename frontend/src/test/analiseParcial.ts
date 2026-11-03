// Cria respostas de teste com os campos nulos e os oito sensores previstos pelo contrato ML.
import type { Estacao, ResultadoAnalise, Serie } from '../api/tipos';

export function criarSerieSemSensores(): Serie {
  return {
    dates: ['2026-11-01', '2026-11-02', '2026-11-03'],
    iqa: [null, null, null],
    iqaClass: [null, null, null],
    anomaly: [false, false, false],
    anomalyScore: [null, null, null],
    params: {
      ph: [null, null, null],
      doMgl: [null, null, null],
      tempC: [null, null, null],
      turbidityNtu: [null, null, null],
      conductivityUscm: [null, null, null],
      nitrateMgl: [null, null, null],
      phosphorusMgl: [null, null, null],
      coliformsNmp: [null, null, null],
    },
  };
}

export const estacaoSemLeituras: Estacao = {
  id: 'rio-a',
  name: 'Rio A',
  type: 'rio',
  lat: null,
  lon: null,
  latest: null,
  predictedClass: null,
  clusterLabel: null,
  alertsRecent: 0,
  worseningTrends: [],
};

export function criarAnaliseParcial(): ResultadoAnalise {
  return {
    generatedAt: '2026-11-03T12:00:00Z',
    period: { start: '2026-11-01', end: '2026-11-03' },
    parameters: {
      ph: { label: 'pH', unit: '' },
      doMgl: { label: 'Oxigênio dissolvido', unit: 'mg/L' },
      tempC: { label: 'Temperatura', unit: '°C' },
      turbidityNtu: { label: 'Turbidez', unit: 'NTU' },
      conductivityUscm: { label: 'Condutividade', unit: 'µS/cm' },
      nitrateMgl: { label: 'Nitrato', unit: 'mg/L' },
      phosphorusMgl: { label: 'Fósforo', unit: 'mg/L' },
      coliformsNmp: { label: 'Coliformes', unit: 'NMP/100 mL' },
    },
    processing: { rawReadings: 6, validReadings: 6, days: 1, discardedDays: 2 },
    stations: [
      {
        stationId: 'rio-a',
        name: 'Rio A',
        type: 'rio',
        latest: null,
        iqaPeriod: null,
        predictedClass: null,
        cluster: null,
        clusterLabel: null,
        worseningTrends: [],
        alertsTotal: 0,
        alertsRecent: 0,
        criticalTotal: 0,
      },
    ],
    insights: [],
    alerts: [],
    anomalies: { method: 'Isolation Forest + z-score (30 dias)', episodes: [], evaluation: null },
    classification: { method: 'Random Forest', accuracy: null, featureImportance: [], current: {} },
    clusters: { method: 'K-Means + PCA', points: [], profiles: [] },
    trends: [],
    series: { 'rio-a': criarSerieSemSensores() },
  };
}
