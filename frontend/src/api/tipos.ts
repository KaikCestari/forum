export type Papel = 'ADMIN' | 'FUNCIONARIO';
export type TipoEstacao = 'rio' | 'lago' | 'reservatorio' | 'estuario';
export type ClasseIqa = 'Ótima' | 'Boa' | 'Regular' | 'Ruim' | 'Péssima';
export interface Usuario {
  id: number;
  name: string;
  email: string;
  role: Papel;
  active: boolean;
}
export interface LoginResposta {
  token: string;
  expiresAt: string;
  user: Usuario;
}
export interface NovoUsuario {
  name: string;
  email: string;
  password: string;
  role: Papel;
}
export interface ResumoDados {
  datasetName: string | null;
  importedAt: string | null;
  stations: number | null;
  measurements: number | null;
  firstReading: string | null;
  lastReading: string | null;
}
export interface ExecucaoAnalise {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: 'EXECUTANDO' | 'CONCLUIDA' | 'FALHOU';
  iqaMean: number | null;
  alertCount: number | null;
  accuracy: number | null;
  error: string | null;
}
export interface Alerta {
  stationId: string;
  date: string;
  parameter: string;
  value: number;
  unit: string;
  severity: 'atencao' | 'critico';
  message: string;
}
export interface Painel {
  hasData: boolean;
  summary: ResumoDados;
  lastRun: ExecucaoAnalise | null;
  iqaMean: number | null;
  stationsAtRisk: number;
  recentAlerts: Alerta[];
  insights: string[];
  imagesPending: number;
  imagesConfirmed: number;
}
export interface UltimaLeitura {
  date: string;
  iqa: number | null;
  iqaClass: ClasseIqa | null;
}
export interface Estacao {
  id: string;
  name: string;
  type: TipoEstacao;
  lat: number | null;
  lon: number | null;
  latest: UltimaLeitura | null;
  predictedClass: ClasseIqa | null;
  clusterLabel: string | null;
  alertsRecent: number;
  worseningTrends: string[];
}
export interface NovaEstacao {
  id?: string;
  name: string;
  type: TipoEstacao;
  lat?: number;
  lon?: number;
}
export interface Serie {
  dates: string[];
  iqa: (number | null)[];
  iqaClass: (ClasseIqa | null)[];
  anomaly: boolean[];
  anomalyScore: (number | null)[];
  // lista toda null = sensor ausente
  params: Record<string, (number | null)[]>;
}
export interface EstacaoAnalisada {
  stationId: string;
  name: string;
  type: TipoEstacao;
  latest: UltimaLeitura | null;
  iqaPeriod: number | null;
  predictedClass: ClasseIqa | null;
  cluster: number | null;
  clusterLabel: string | null;
  worseningTrends: string[];
  alertsTotal: number;
  alertsRecent: number;
  criticalTotal: number;
}
export interface PontoGrupo {
  stationId: string;
  date: string;
  x: number;
  y: number;
  cluster: number;
}
export interface PerfilGrupo {
  cluster: number;
  label: string;
  size: number;
  means: Record<string, number | null>;
}
export interface ResultadoAnalise {
  generatedAt: string;
  period: { start: string; end: string };
  parameters: Record<string, { label: string; unit: string }>;
  processing: { rawReadings: number; validReadings: number; days: number; discardedDays: number };
  stations: EstacaoAnalisada[];
  insights: string[];
  alerts: Alerta[];
  anomalies: {
    method: string;
    episodes: {
      stationId: string;
      start: string;
      end: string;
      days: number;
      maxScore: number | null;
      parameters: string[];
    }[];
    evaluation: { knownEvents: number; detected: number; recall: number } | null;
  };
  classification: {
    method: string;
    accuracy: number | null;
    featureImportance: { feature: string; importance: number }[];
    current: Record<string, ClasseIqa>;
  };
  clusters: {
    method: string;
    points: PontoGrupo[];
    profiles: PerfilGrupo[];
  };
  trends: {
    stationId: string;
    parameter: string;
    direction: 'piora' | 'melhora' | 'estavel';
    slopePerYear: number | null;
    pValue: number | null;
  }[];
  series: Record<string, Serie>;
}
export type Turbidez = 'baixa' | 'media' | 'alta';
export interface LeituraVisual {
  waterColor: string | null;
  turbidity: Turbidez | null;
  algaeBloom: boolean | null;
  foam: boolean | null;
  oil: boolean | null;
  floatingDebris: boolean | null;
  surroundings: string | null;
  attentionLevel: 0 | 1 | 2 | 3;
  summary: string;
}
export interface ImagemAgua {
  id: number;
  stationId: string;
  stationName: string;
  kind: 'foto' | 'satelite';
  observedOn: string;
  uploadedAt: string;
  uploadedBy: string;
  status: 'PENDENTE' | 'CONFIRMADA' | 'ERRO_ANALISE';
  fileUrl: string;
  colorIndicators: {
    meanRed: number;
    meanGreen: number;
    meanBlue: number;
    brightnessPct: number;
    greenRedIndex: number;
    blueRatio: number;
    greenishFraction: number;
    darkFraction: number;
  };
  vision: LeituraVisual | null;
  analysisError: string | null;
}
export interface ConfirmacaoImagem {
  waterColor?: string;
  turbidity?: Turbidez;
  algaeBloom?: boolean;
  foam?: boolean;
  oil?: boolean;
  floatingDebris?: boolean;
  attentionLevel?: 0 | 1 | 2 | 3;
  notes?: string;
}
export type TipoAnotacao = 'observacao' | 'coleta' | 'evento';
export interface NovaAnotacao {
  stationId: string;
  notedOn: string;
  kind: TipoAnotacao;
  text: string;
}
export interface Anotacao extends NovaAnotacao {
  id: number;
  stationName: string;
  author: string;
  createdAt: string;
}
export interface MensagemChat {
  id: number;
  question: string;
  answer: string;
  model: string;
  createdAt: string;
}
export interface StatusAssistente {
  available: boolean;
  model: string;
}
export interface Importacao {
  name: string;
  measurements: number;
  stations: number;
  events: number;
  readingsPerDay: number;
  warnings: string[];
  analysis: ExecucaoAnalise;
}
