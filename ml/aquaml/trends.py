"""Detecção de tendências de longo prazo (Mann-Kendall sazonal + declive de Sen).

O teste sazonal (Hirsch et al., 1982) compara cada mês apenas com o mesmo mês
de outros anos, de modo que o ciclo sazonal não é confundido com tendência.
"""

from __future__ import annotations

from itertools import combinations

import numpy as np
import pandas as pd
from scipy.stats import norm

from . import PARAMS, WORSE_DIRECTION, label, unit

ALPHA = 0.05
MIN_PCT_PER_YEAR = 5.0  # mudanças menores que isso não são consideradas relevantes


def monthly_means(df: pd.DataFrame, param: str) -> pd.Series:
    d = df[["date", param]].dropna()
    return d.groupby(pd.to_datetime(d["date"]).dt.to_period("M"))[param].mean()


def seasonal_mann_kendall(m: pd.Series) -> tuple[float, float, float]:
    """Retorna (tau, p-valor, declive de Sen por ano) para médias mensais."""
    s_total, var_total, pairs_total, slopes = 0, 0.0, 0, []
    for _, g in m.groupby(m.index.month):
        years = g.index.year.to_numpy()
        x = g.to_numpy()
        n = len(x)
        if n < 2:
            continue
        for i, j in combinations(range(n), 2):
            s_total += np.sign(x[j] - x[i])
            slopes.append((x[j] - x[i]) / (years[j] - years[i]))
        var_total += n * (n - 1) * (2 * n + 5) / 18
        pairs_total += n * (n - 1) // 2
    if var_total == 0:
        return 0.0, 1.0, 0.0
    z = (s_total - np.sign(s_total)) / np.sqrt(var_total)
    p = 2 * (1 - norm.cdf(abs(z)))
    return s_total / pairs_total, float(p), float(np.median(slopes))


def analyze(df: pd.DataFrame) -> list[dict]:
    out = []
    for sid, g in df.groupby("station_id", sort=True):
        for p in PARAMS + ["iqa"]:
            m = monthly_means(g, p)
            if len(m) < 13:
                continue
            tau, pval, slope = seasonal_mann_kendall(m)
            mean = float(g[p].mean())
            pct_year = 100 * slope / mean if mean else 0.0
            significant = bool(pval < ALPHA and abs(pct_year) >= MIN_PCT_PER_YEAR)
            worse = WORSE_DIRECTION[p]
            if not significant:
                verdict = "estável"
            elif worse == 0:
                verdict = "alteração"
            else:
                verdict = "piora" if np.sign(slope) == worse else "melhora"
            out.append({
                "station_id": sid,
                "parameter": p,
                "label": label(p),
                "unit": unit(p),
                "tau": round(float(tau), 3),
                "p_value": round(pval, 4),
                "slope_per_year": round(slope, 4),
                "pct_per_year": round(pct_year, 1),
                "mean": round(mean, 4),
                "significant": significant,
                "direction": "aumento" if slope > 0 else "redução",
                "verdict": verdict,
                "monthly": [{"month": str(k), "value": round(float(v), 4)} for k, v in m.items()],
            })
    return out
