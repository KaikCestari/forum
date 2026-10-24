// Tipos do results.json produzido pela etapa de ML e servido pela API Java.

export type IqaClass = "Ótima" | "Boa" | "Regular" | "Ruim" | "Péssima";
export type Severity = "critico" | "alto" | "atencao" | "cronico";
export type StationType = "rio" | "lago" | "reservatorio" | "estuario";

export interface Station {
  id: string;
  name: string;
  type: StationType;
  lat: number | null;
  lon: number | null;
  latest: { date: string; iqa: number; iqa_class: IqaClass } & Record<string, number | string>;
  iqa_30d: number;
  iqa_period: number;
  predicted: { date: string; predicted: IqaClass; confidence: number } | null;
  cluster: number | null;
  cluster_label: string | null;
  worsening_trends: string[];
  alerts_total: number;
  alerts_recent: number;
  critical_total: number;
}

export interface Alert {
  id: number;
  station_id: string;
  station_name: string;
  category: string;
  severity: Severity;
  parameter: string | null;
  title: string;
  start: string;
  end: string;
  days: number | null;
  peak: number;
  message: string;
  recommendation: string;
  params?: string[];
}

export interface Episode {
  station_id: string;
  start: string;
  end: string;
  days: number;
  max_score: number;
  params: string[];
}

export interface KnownEvent {
  station_id: string;
  start: string;
  end: string;
  type: string;
  description: string;
  detected: boolean;
}

export interface Classification {
  model: string;
  train_period: [string, string];
  test_period: [string, string];
  n_train: number;
  n_test: number;
  accuracy: number;
  f1_macro: number;
  accuracy_one_sensor_missing: number;
  labels: IqaClass[];
  confusion_matrix: number[][];
  feature_importance: { feature: string; importance: number }[];
}

export interface ClusterPoint {
  station_id: string;
  month: string;
  x: number;
  y: number;
  cluster: number;
  iqa: number;
}

export interface Clusters {
  k: number;
  explained_variance: number[];
  profiles: { cluster: number; label: string; months: number; stations: string[]; mean: Record<string, number> }[];
  points: ClusterPoint[];
  latest: Record<string, number>;
}

export interface Trend {
  station_id: string;
  parameter: string;
  label: string;
  unit: string;
  p_value: number;
  slope_per_year: number;
  pct_per_year: number;
  significant: boolean;
  direction: string;
  verdict: "piora" | "melhora" | "alteração" | "estável";
  monthly: { month: string; value: number }[];
}

export interface Processing {
  rows_read: number;
  stations: number;
  missing_values: number;
  invalid_total: number;
  interpolated_hourly: number;
  interpolated_daily: number;
  days_output: number;
  days_with_iqa: number;
  threads: number;
  total_ms: number;
}

export interface Overview {
  generated_at: string;
  period: [string, string];
  parameters: Record<string, { label: string; unit: string }>;
  processing: Processing | null;
  stations: Station[];
  alerts: Alert[];
  anomalies: {
    method: string;
    episodes: Episode[];
    evaluation: {
      event_recall: number;
      day_precision: number;
      day_recall: number;
      anomalous_days: number;
      events: KnownEvent[];
    } | null;
  };
  classification: Classification;
  clusters: Clusters;
  trends: Trend[];
  timings_s: Record<string, number>;
  insights: string[];
}

export type Series = {
  dates: string[];
  iqa_class: (IqaClass | "")[];
  anomaly: boolean[];
} & Record<string, (number | null)[]>;

export interface PipelineStep {
  name: string;
  language: "Python" | "Rust" | "Java";
  status: "executando" | "ok" | "erro";
  durationMs: number;
  output: string;
}

export interface PipelineStatus {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  steps: PipelineStep[];
  error: string | null;
}

// Banco H2: conjunto de dados atual, histórico de análises e agregados em SQL.

export type DataSource = "real" | "sintetico";

export interface DbSummary {
  dataset: { source: DataSource; name: string | null; imported_at: string } | null;
  totals: {
    stations: number;
    measurements: number;
    first_reading: string | null;
    last_reading: string | null;
    events: number;
    daily_rows: number;
    runs: number;
    messages: number;
  };
  stations: {
    id: string;
    name: string;
    type: StationType;
    readings: number;
    first_reading: string | null;
    last_reading: string | null;
    readings_per_day: number;
  }[];
}

export interface AnalysisRun {
  id: number;
  created_at: string;
  source: DataSource;
  dataset_name: string | null;
  period_start: string | null;
  period_end: string | null;
  stations: number;
  alerts: number;
  critical_alerts: number;
  accuracy: number | null;
  mean_iqa: number | null;
}

export interface MonthlyRow {
  station_id: string;
  station_name: string | null;
  month: string;
  iqa_mean: number | null;
  iqa_min: number | null;
  do_mean: number | null;
  phosphorus_mean: number | null;
  coliforms_mean: number | null;
  anomaly_days: number;
  days: number;
}

export interface ImportResult {
  name: string;
  measurements: number;
  stations: number;
  events: number;
  readingsPerDay: number;
  warnings: string[];
  pipeline: PipelineStatus;
}

// Assistente Llama (Ollama).

export interface LlamaStatus {
  available: boolean;
  modelInstalled: boolean;
}

/** Mensagem guardada no H2 (histórico) ou recém-respondida (`durationMs`). */
export interface AssistantMessage {
  id: number;
  question: string;
  answer: string;
  model: string;
  duration_ms?: number;
  durationMs?: number;
  created_at?: string;
}

// Caderno de campo: anotações da equipe por estação.

export type NoteKind = "observacao" | "coleta" | "ocorrencia" | "manejo";

export interface FieldNote {
  id: number;
  station_id: string;
  noted_on: string;
  kind: NoteKind;
  text: string;
  created_at: string;
}

// Imagens: foto da água e imagem de satélite, lidas pela IA e conferidas pelo biólogo.

export type ImageKind = "foto" | "satelite";
export type Turbidity = "baixa" | "media" | "alta" | "nao_avaliavel";
export type Bloom = "nenhuma" | "possivel" | "provavel" | "nao_avaliavel";
export type Vegetation = "ausente" | "pouca" | "abundante" | "nao_avaliavel";
export type Riparian = "preservada" | "parcial" | "ausente" | "nao_avaliavel";

export interface ImageAnalysis {
  cor_da_agua: string;
  turbidez: Turbidity;
  floracao_algas: Bloom;
  espuma?: boolean;
  oleo_ou_filme?: boolean;
  material_flutuante?: boolean;
  vegetacao_aquatica?: Vegetation;
  uso_do_entorno?: string;
  vegetacao_ribeirinha?: Riparian;
  nivel_de_atencao: 0 | 1 | 2 | 3;
  resumo: string;
  o_que_conferir_em_campo: string;
  confianca: number;
}

export interface ImageObservation {
  id: number;
  station_id: string;
  observed_on: string;
  kind: ImageKind;
  mime: string;
  width: number;
  height: number;
  note: string | null;
  metrics: Record<string, number>;
  analysis: ImageAnalysis;
  analysis_error: string | null;
  model: string | null;
  status: "pendente" | "confirmado";
  created_at: string;
  confirmed_at: string | null;
  file_url: string;
}

export interface Point {
  id: string;
  name: string;
  type: StationType;
  lat: number | null;
  lon: number | null;
}
