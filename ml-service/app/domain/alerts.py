"""Alertas por limites legais (Resolução CONAMA 357/2005).

O que faz: compara a média diária de cada parâmetro com os limites da lei
brasileira para rios, lagos e reservatórios de classe 2 (água doce que pode
ser usada para abastecimento após tratamento, recreação e pesca). Para
estuários usamos os limites de água salobra classe 1.

Dois níveis de gravidade:
- "atencao": o valor passou do limite da CONAMA;
- "critico": o valor passou muito do limite (ex.: oxigênio abaixo de 3 mg/L,
  nível em que peixes começam a morrer).

Para não gerar um alerta por dia, dias de violação próximos (separados por
até 2 dias) são agrupados num único episódio. O alerta usa a data do último
dia do episódio e o pior valor observado nele.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import pandas as pd

from .parameters import label, unit

MERGE_GAP_DAYS = 2  # dias sem violação tolerados dentro de um mesmo episódio


def phosphorus_limit(station_type: str) -> float:
    """Fósforo total máximo (mg/L): ambientes parados acumulam mais nutrientes."""
    return {"lago": 0.03, "reservatorio": 0.03, "estuario": 0.124}.get(station_type, 0.1)


def ph_range(station_type: str) -> tuple[float, float]:
    return (6.5, 8.5) if station_type == "estuario" else (6.0, 9.0)


def _br(x: float) -> str:
    """Número no formato brasileiro (vírgula decimal)."""
    return f"{x:g}".replace(".", ",")


@dataclass(frozen=True)
class Rule:
    parameter: str
    # Recebem (valores, tipo da estação) e devolvem uma série verdadeiro/falso.
    exceeds: Callable[[pd.Series, str], pd.Series]
    critical: Callable[[pd.Series, str], pd.Series]
    # Frase curta sobre o limite, ex.: "abaixo de 5 mg/L".
    describe: Callable[[str], str]
    worst: str  # "min", "max" ou "far" (mais longe do centro da faixa, para o pH)


RULES = [
    Rule("doMgl", lambda v, t: v < 5.0, lambda v, t: v < 3.0,
         lambda t: "abaixo de 5 mg/L", "min"),
    Rule("coliformsNmp", lambda v, t: v > 1000, lambda v, t: v > 20000,
         lambda t: "acima de 1000 NMP/100mL", "max"),
    Rule("phosphorusMgl", lambda v, t: v > phosphorus_limit(t), lambda v, t: v > 0.5,
         lambda t: f"acima de {_br(phosphorus_limit(t))} mg/L", "max"),
    Rule("nitrateMgl", lambda v, t: v > 10.0, lambda v, t: v > 20.0,
         lambda t: "acima de 10 mg/L", "max"),
    Rule("turbidityNtu", lambda v, t: v > 100, lambda v, t: v > 300,
         lambda t: "acima de 100 NTU", "max"),
    Rule("ph",
         lambda v, t: (v < ph_range(t)[0]) | (v > ph_range(t)[1]),
         lambda v, t: (v < ph_range(t)[0] - 1) | (v > ph_range(t)[1] + 1),
         lambda t: "fora da faixa de {} a {}".format(*map(_br, ph_range(t))), "far"),
]


def group_runs(dates: pd.Series, max_gap: int = MERGE_GAP_DAYS) -> list[list[int]]:
    """Agrupa posições de dias em episódios, unindo dias separados por até `max_gap` dias.
    `dates` deve estar em ordem crescente; devolve listas de posições."""
    runs: list[list[int]] = []
    previous = None
    for pos, day in enumerate(pd.to_datetime(dates)):
        if previous is not None and (day - previous).days <= max_gap + 1:
            runs[-1].append(pos)
        else:
            runs.append([pos])
        previous = day
    return runs


def _worst_value(values: pd.Series, rule: Rule, station_type: str) -> float:
    if rule.worst == "min":
        return float(values.min())
    if rule.worst == "max":
        return float(values.max())
    center = sum(ph_range(station_type)) / 2
    return float(values.loc[(values - center).abs().idxmax()])


def _format_value(value: float, parameter: str) -> str:
    if parameter == "coliformsNmp":
        return f"{value:,.0f}".replace(",", ".")
    return f"{value:.2f}".replace(".", ",")


def station_alerts(days: pd.DataFrame, station_type: str) -> list[dict]:
    """Alertas de uma estação. `days` = tabela diária da estação, ordenada por data."""
    alerts = []
    for rule in RULES:
        values = days[rule.parameter]
        exceeds = rule.exceeds(values, station_type).fillna(False).astype(bool)
        critical = rule.critical(values, station_type).fillna(False).astype(bool)
        bad = days[exceeds]
        if bad.empty:
            continue
        for run in group_runs(bad["date"]):
            run_rows = bad.iloc[run]
            worst = _worst_value(run_rows[rule.parameter], rule, station_type)
            n_days = len(run_rows)
            severity = "critico" if critical.loc[run_rows.index].any() else "atencao"
            text_unit = unit(rule.parameter)
            alerts.append({
                "stationId": str(days["stationId"].iloc[0]),
                "date": str(run_rows["date"].iloc[-1]),
                "parameter": rule.parameter,
                "value": round(worst, 4),
                "unit": text_unit,
                "severity": severity,
                "message": (f"{label(rule.parameter)} {rule.describe(station_type)} "
                            f"(limite CONAMA 357) em {n_days} dia(s); pior valor "
                            f"{_format_value(worst, rule.parameter)} {text_unit}".rstrip() + "."),
            })
    return alerts


def build_alerts(daily: pd.DataFrame, station_types: dict[str, str]) -> list[dict]:
    """Alertas de todas as estações, do mais recente para o mais antigo
    (no mesmo dia, os críticos primeiro)."""
    alerts: list[dict] = []
    for station_id, days in daily.groupby("stationId", sort=True):
        stype = station_types.get(station_id, "rio")
        alerts += station_alerts(days.sort_values("date"), stype)
    alerts.sort(key=lambda a: (a["date"], a["severity"] == "critico"), reverse=True)
    return alerts
