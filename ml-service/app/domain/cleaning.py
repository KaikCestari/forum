from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .parameters import PARAMETERS, PARAM_KEYS

MIN_READINGS_PER_DAY = 6   # leituras mínimas para um dia contar
MAX_HOURLY_GAP = 6         # maior buraco (horas) preenchido por interpolação
MAX_DAILY_GAP = 3          # maior buraco (dias) preenchido por interpolação
ZSCORE_WINDOW = 30         # janela do z-score (dias anteriores)
ZSCORE_MIN_OBS = 10        # dias mínimos com dado para calcular o z-score
TEMP_REF_WINDOW = 30       # janela da temperatura de referência do IQA


class InsufficientDataError(ValueError):
    """Os dados enviados não permitem nenhuma análise (mensagem em português)."""


@dataclass
class CleaningReport:
    raw_readings: int = 0      # linhas de medição recebidas
    valid_readings: int = 0    # linhas com data válida e ao menos um valor plausível
    days: int = 0              # dias (estação × data) que entraram na análise
    discarded_days: int = 0    # dias com leituras, mas abaixo do mínimo

    def as_dict(self) -> dict[str, int]:
        return {"rawReadings": self.raw_readings, "validReadings": self.valid_readings,
                "days": self.days, "discardedDays": self.discarded_days}


def validate_ranges(values: pd.DataFrame) -> pd.DataFrame:
    """Troca por vazio (NaN) todo valor fora da faixa física do parâmetro."""
    out = values.astype(float)
    for p in PARAMETERS:
        col = out[p.key]
        bad = ~np.isfinite(col) | (col < p.min) | (col > p.max)
        out[p.key] = col.mask(bad)
    return out


def interpolate_short_gaps(series: pd.Series, max_gap: int) -> pd.Series:
    """Interpolação linear só em buracos internos de até `max_gap` posições."""
    if series.notna().sum() < 2:
        return series
    missing = series.isna()
    run_id = (~missing).cumsum()
    run_len = missing.groupby(run_id).transform("sum")
    filled = series.interpolate(method="linear", limit_area="inside")
    return filled.mask(missing & (run_len > max_gap))


def rolling_zscore(series: pd.Series, window: int = ZSCORE_WINDOW,
                   min_obs: int = ZSCORE_MIN_OBS) -> pd.Series:
    """Z-score de cada dia em relação aos `window` dias ANTERIORES (sem o próprio dia)."""
    past = series.shift(1).rolling(window, min_periods=min_obs)
    mean, sd = past.mean(), past.std(ddof=1)
    # Piso no desvio evita z-scores explosivos em séries quase constantes.
    sd = np.maximum(sd, np.maximum(mean.abs() * 0.01, 1e-6))
    return ((series - mean) / sd).where(series.notna())


def rolling_mean_half(series: pd.Series, window: int) -> pd.Series:
    """Média móvel retroativa que exige ao menos metade da janela com dados."""
    roll = series.rolling(window, min_periods=1)
    mean, count = roll.mean(), roll.count()
    needed = np.minimum(window, np.arange(1, len(series) + 1))
    return mean.where(count * 2 >= needed)


def _station_daily(readings: pd.DataFrame) -> tuple[pd.DataFrame, int, int]:
    """Processa uma estação. Devolve (tabela diária, dias aceitos, dias descartados)."""
    readings = readings.set_index("timestamp").sort_index()

    # Quantas leituras válidas cada dia recebeu (antes de qualquer preenchimento).
    per_day = readings.groupby(readings.index.normalize()).size()
    kept_days = per_day.index[per_day >= MIN_READINGS_PER_DAY]

    # Grade horária regular + lacunas curtas preenchidas.
    hourly = readings[PARAM_KEYS].groupby(readings.index.floor("h")).mean()
    hourly = hourly.asfreq("h")
    hourly = hourly.apply(lambda s: interpolate_short_gaps(s, MAX_HOURLY_GAP))

    # Média diária, só com 6 ou mais horas daquele parâmetro.
    by_day = hourly.groupby(hourly.index.normalize())
    daily = by_day.mean().where(by_day.count() >= MIN_READINGS_PER_DAY)

    # Calendário contínuo, para janelas móveis contarem dias de verdade.
    daily = daily.asfreq("D")
    daily = daily.apply(lambda s: interpolate_short_gaps(s, MAX_DAILY_GAP))
    for key in PARAM_KEYS:
        daily[f"{key}Z30"] = rolling_zscore(daily[key])
    daily["tempRef"] = rolling_mean_half(daily["tempC"], TEMP_REF_WINDOW)

    daily = daily.loc[daily.index.isin(kept_days)]
    daily = daily.dropna(subset=PARAM_KEYS, how="all")
    discarded = int((per_day > 0).sum()) - len(daily)
    return daily, len(daily), discarded


def build_daily_table(measurements: pd.DataFrame) -> tuple[pd.DataFrame, CleaningReport]:
    """Leituras brutas → tabela diária limpa (uma linha por estação e dia)."""
    report = CleaningReport(raw_readings=len(measurements))
    if measurements.empty:
        raise InsufficientDataError("Nenhuma medição foi enviada para a análise.")

    data = measurements.copy()
    data["timestamp"] = _parse_timestamps(data["timestamp"])
    data[PARAM_KEYS] = validate_ranges(data[PARAM_KEYS])
    data = data.dropna(subset=["timestamp", "stationId"])
    data = data.dropna(subset=PARAM_KEYS, how="all")
    report.valid_readings = len(data)
    if data.empty:
        raise InsufficientDataError(
            "Nenhuma medição tem data válida e valores plausíveis; confira a planilha.")

    tables = []
    for station_id, group in data.groupby("stationId", sort=True):
        daily, kept, discarded = _station_daily(group)
        report.days += kept
        report.discarded_days += discarded
        if kept:
            daily = daily.rename_axis("date").reset_index()
            daily.insert(0, "stationId", station_id)
            tables.append(daily)

    if not tables:
        raise InsufficientDataError(
            f"Nenhum dia tem pelo menos {MIN_READINGS_PER_DAY} leituras válidas. "
            "Envie mais medições por dia (por exemplo, uma por hora) para rodar a análise.")
    table = pd.concat(tables, ignore_index=True)
    table["date"] = table["date"].dt.strftime("%Y-%m-%d")
    return table, report


def _parse_timestamps(values: pd.Series) -> pd.Series:
    """Converte textos ISO-8601 em data-hora; inválidos viram vazio."""
    parsed = pd.to_datetime(values, errors="coerce", format="ISO8601", utc=True)
    return parsed.dt.tz_localize(None)
