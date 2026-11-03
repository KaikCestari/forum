"""Formato dos dados que entram e saem da API (contrato com o backend Java).

As classes abaixo descrevem exatamente o JSON da seção 2 de
`docs/CONTRATO-API.md`. No Python os campos usam snake_case; no JSON viram
camelCase automaticamente (ex.: `do_mgl` ↔ `doMgl`, `station_id` ↔ `stationId`).
Não há lógica aqui: só a forma dos dados.
"""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base: aceita e devolve camelCase; NaN/infinito viram null no JSON."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True,
                              ser_json_inf_nan="null")


# ---------------------------------------------------------------- pedido

class StationIn(CamelModel):
    id: str
    name: str | None = None
    type: str = "rio"  # rio | lago | reservatorio | estuario
    lat: float | None = None
    lon: float | None = None


class MeasurementIn(CamelModel):
    timestamp: str
    station_id: str
    ph: float | None = None
    do_mgl: float | None = None
    temp_c: float | None = None
    turbidity_ntu: float | None = None
    conductivity_uscm: float | None = None
    nitrate_mgl: float | None = None
    phosphorus_mgl: float | None = None
    coliforms_nmp: float | None = None


class EventIn(CamelModel):
    station_id: str
    start: date
    end: date | None = None  # sem fim = evento de um dia
    type: str | None = None
    description: str | None = None


class AnalyzeRequest(CamelModel):
    stations: list[StationIn] = Field(default_factory=list)
    measurements: list[MeasurementIn] = Field(default_factory=list)
    events: list[EventIn] = Field(default_factory=list)


# ---------------------------------------------------------------- resposta

class Period(CamelModel):
    start: str
    end: str


class ParameterInfo(CamelModel):
    label: str
    unit: str


class Processing(CamelModel):
    raw_readings: int
    valid_readings: int
    days: int
    discarded_days: int


class LatestIqa(CamelModel):
    date: str
    iqa: float | None
    iqa_class: str | None


class StationSummary(CamelModel):
    station_id: str
    name: str
    type: str
    latest: LatestIqa | None
    iqa_period: float | None
    predicted_class: str | None
    cluster: int | None
    cluster_label: str | None
    worsening_trends: list[str]
    alerts_total: int
    alerts_recent: int
    critical_total: int


class Alert(CamelModel):
    station_id: str
    date: str
    parameter: str
    value: float | None
    unit: str
    severity: str  # atencao | critico
    message: str


class Episode(CamelModel):
    station_id: str
    start: str
    end: str
    days: int
    max_score: float | None
    parameters: list[str]


class Evaluation(CamelModel):
    known_events: int
    detected: int
    recall: float


class Anomalies(CamelModel):
    method: str
    episodes: list[Episode]
    evaluation: Evaluation | None


class FeatureImportance(CamelModel):
    feature: str
    importance: float


class Classification(CamelModel):
    method: str
    accuracy: float | None
    feature_importance: list[FeatureImportance]
    current: dict[str, str]


class ClusterPoint(CamelModel):
    station_id: str
    date: str
    x: float
    y: float
    cluster: int


class ClusterProfile(CamelModel):
    cluster: int
    label: str
    size: int
    means: dict[str, float | None]


class Clusters(CamelModel):
    method: str
    points: list[ClusterPoint]
    profiles: list[ClusterProfile]


class Trend(CamelModel):
    station_id: str
    parameter: str
    direction: str  # piora | melhora | estavel
    slope_per_year: float | None
    p_value: float | None


class StationSeries(CamelModel):
    dates: list[str]
    iqa: list[float | None]
    iqa_class: list[str | None]
    anomaly: list[bool]
    anomaly_score: list[float | None]
    params: dict[str, list[float | None]]


class AnalysisResult(CamelModel):
    generated_at: str
    period: Period
    parameters: dict[str, ParameterInfo]
    processing: Processing
    stations: list[StationSummary]
    insights: list[str]
    alerts: list[Alert]
    anomalies: Anomalies
    classification: Classification
    clusters: Clusters
    trends: list[Trend]
    series: dict[str, StationSeries]
