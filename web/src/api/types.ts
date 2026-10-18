// Tipos do results.json produzido pela etapa de ML e servido pela API Java.

export type IqaClass = "Ótima" | "Boa" | "Regular" | "Ruim" | "Péssima";
export type Severity = "critico" | "alto" | "atencao" | "cronico";
export type StationType = "rio" | "lago" | "reservatorio" | "estuario";

export interface Station {
  id: string;
  name: string;
  type: StationType;
  lat: number;
  lon: number;
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
