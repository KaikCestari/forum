from __future__ import annotations

import math
from itertools import combinations

import numpy as np
import pandas as pd

from app.domain.parameters import BY_KEY, NEUTRAL_PH, PARAM_KEYS

from .features import available_columns

ALPHA = 0.05
MIN_PCT_PER_YEAR = 5.0
MIN_MONTHS_SEASONAL = 13
MIN_WEEKS = 8
DAYS_PER_YEAR = 365.25


def mann_kendall(values: np.ndarray, years: np.ndarray, seasons: np.ndarray) -> tuple[float, float]:
    """Mann-Kendall (sazonal se houver mais de uma estação do ano em `seasons`)."""
    s_total, var_total, slopes = 0.0, 0.0, []
    for season in np.unique(seasons):
        idx = np.flatnonzero(seasons == season)
        n = len(idx)
        if n < 2:
            continue
        for i, j in combinations(idx, 2):
            s_total += np.sign(values[j] - values[i])
            dt = years[j] - years[i]
            if dt != 0:
                slopes.append((values[j] - values[i]) / dt)
        var_total += n * (n - 1) * (2 * n + 5) / 18
    if var_total == 0 or not slopes:
        return 1.0, 0.0
    z = (s_total - np.sign(s_total)) / math.sqrt(var_total)
    p_value = math.erfc(abs(z) / math.sqrt(2))  # bicaudal, distribuição normal
    return float(p_value), float(np.median(slopes))


def _aggregate(days: pd.DataFrame, param: str) -> tuple[pd.Series, bool] | None:
    """Médias mensais (teste sazonal) ou semanais (teste comum). None se curto demais."""
    series = days.set_index(pd.to_datetime(days["date"]))[param].dropna()
    monthly = series.resample("MS").mean().dropna()
    if len(monthly) >= MIN_MONTHS_SEASONAL:
        return monthly, True
    weekly = series.resample("W").mean().dropna()
    if len(weekly) >= MIN_WEEKS:
        return weekly, False
    return None


def _direction(param: str, slope: float, mean: float, significant: bool) -> str:
    if not significant or slope == 0:
        return "estavel"
    worse_when = BY_KEY[param].worse_when
    if worse_when == 0:  # pH: piora quando se afasta do neutro
        worse_when = 1 if mean >= NEUTRAL_PH else -1
    return "piora" if np.sign(slope) == worse_when else "melhora"


def analyze(daily: pd.DataFrame) -> list[dict]:
    out = []
    for station_id, days in daily.groupby("stationId", sort=True):
        for param in available_columns(days, PARAM_KEYS):
            agg = _aggregate(days, param)
            if agg is None:
                continue
            means, seasonal = agg
            years = ((means.index - means.index[0]).days / DAYS_PER_YEAR).to_numpy()
            seasons = means.index.month.to_numpy() if seasonal else np.zeros(len(means))
            p_value, slope = mann_kendall(means.to_numpy(), years, seasons)
            mean = float(days[param].mean())
            pct_per_year = 100 * slope / abs(mean) if mean else 0.0
            significant = p_value < ALPHA and abs(pct_per_year) >= MIN_PCT_PER_YEAR
            out.append({
                "stationId": str(station_id),
                "parameter": param,
                "direction": _direction(param, slope, mean, significant),
                "slopePerYear": round(slope, 4),
                "pValue": round(p_value, 4),
            })
    return out
