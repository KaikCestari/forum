from __future__ import annotations

import math

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from app.domain.parameters import PARAM_KEYS

from .features import RANDOM_STATE, available_columns, log_transform

METHOD = "Isolation Forest + z-score (30 dias)"
BASELINE_DAYS = 60        # janela da referência móvel (mediana)
BASELINE_LAG = 7          # folga entre a referência e o dia avaliado
BASELINE_MIN_DAYS = 20    # dias mínimos na janela para haver referência
MIN_DAYS_FOREST = 30      # dias mínimos com referência para treinar a floresta
CONTAMINATION = 0.02      # fração esperada de dias anômalos (2%)
Z_RULE = 4.0              # |z| acima disso é um desvio forte
TOP_PARAM_Z = 2.5         # desvio mínimo para um parâmetro ser citado no episódio
EPISODE_MAX_GAP = 1       # dias normais tolerados dentro de um episódio
EVENT_TOLERANCE_DAYS = 2  # folga ao comparar com eventos conhecidos


def residual_features(station: pd.DataFrame, params: list[str]) -> pd.DataFrame:
    """Desvio de cada parâmetro em relação à mediana móvel recente, em unidades robustas (MAD), alinhado às linhas de `station`."""
    x = log_transform(station, params)
    x.index = pd.to_datetime(station["date"])
    x = x.asfreq("D")  # calendário contínuo: janelas contam dias reais
    base = x.shift(BASELINE_LAG).rolling(BASELINE_DAYS, min_periods=BASELINE_MIN_DAYS).median()
    resid = x - base
    mad = (resid - resid.median()).abs().median() * 1.4826
    feats = resid / mad.replace(0, np.nan)
    feats = feats.reindex(pd.to_datetime(station["date"]))
    feats.index = station.index
    return feats


def _forest_scores(feats: pd.DataFrame, valid: pd.Series) -> tuple[pd.Series, pd.Series]:
    """Treina o Isolation Forest nos dias válidos. Devolve (score 0..1, marcado?)."""
    score = pd.Series(np.nan, index=feats.index)
    flag = pd.Series(False, index=feats.index)
    if valid.sum() < MIN_DAYS_FOREST:
        return score, flag
    X = feats[valid].fillna(0.0).clip(-15, 15)
    model = IsolationForest(n_estimators=200, contamination=CONTAMINATION,
                            random_state=RANDOM_STATE)
    model.fit(X)
    score[valid] = -model.score_samples(X)  # 0..1, maior = mais anômalo
    flag[valid] = model.predict(X) == -1
    return score, flag


def _top_params(feats: pd.DataFrame) -> list[list[str]]:
    """Até 3 parâmetros que mais fugiram do normal em cada dia."""
    values = np.nan_to_num(feats.abs().to_numpy(dtype=float), nan=0.0)
    columns = np.array(feats.columns)
    order = np.argsort(-values, axis=1, kind="stable")[:, :3]
    return [[str(columns[j]) for j in row_order if row[j] > TOP_PARAM_Z]
            for row, row_order in zip(values, order)]


def detect(daily: pd.DataFrame) -> tuple[pd.DataFrame, bool]:
    """Uma linha por (estação, dia) com score, marcação e parâmetros mais desviantes."""
    frames = []
    forest_ran = False
    for station_id, g in daily.groupby("stationId", sort=True):
        g = g.sort_values("date")
        params = available_columns(g, PARAM_KEYS)
        if not params:
            continue
        feats = residual_features(g, params)
        needed = math.ceil(0.75 * len(params))
        valid = feats.notna().sum(axis=1) >= needed
        score, forest_flag = _forest_scores(feats, valid)
        forest_ran |= bool(score.notna().any())

        z = g[[f"{p}Z30" for p in params]].abs()
        z_flag = (z > Z_RULE).sum(axis=1) >= min(2, len(params))

        frames.append(pd.DataFrame({
            "stationId": station_id,
            "date": g["date"],
            "score": score,
            "anomaly": forest_flag | z_flag,
            "topParams": _top_params(feats),
        }))
    if not frames:
        empty = pd.DataFrame(columns=["stationId", "date", "score", "anomaly", "topParams"])
        return empty, False
    return pd.concat(frames, ignore_index=True), forest_ran


def episodes(flags: pd.DataFrame) -> list[dict]:
    """Agrupa dias anômalos próximos em episódios (do mais recente ao mais antigo)."""
    out = []
    for station_id, g in flags[flags["anomaly"].astype(bool)].groupby("stationId", sort=True):
        g = g.assign(day=pd.to_datetime(g["date"])).sort_values("day")
        current: list[int] = []
        for idx, day in zip(g.index, g["day"]):
            if current and (day - g.loc[current[-1], "day"]).days > EPISODE_MAX_GAP + 1:
                out.append(_episode(station_id, g.loc[current]))
                current = []
            current.append(idx)
        if current:
            out.append(_episode(station_id, g.loc[current]))
    out.sort(key=lambda e: e["end"], reverse=True)
    return out


def _episode(station_id: str, rows: pd.DataFrame) -> dict:
    counts: dict[str, int] = {}
    for tops in rows["topParams"]:
        for p in tops:
            counts[p] = counts.get(p, 0) + 1
    max_score = rows["score"].max()
    return {
        "stationId": station_id,
        "start": rows["day"].iloc[0].strftime("%Y-%m-%d"),
        "end": rows["day"].iloc[-1].strftime("%Y-%m-%d"),
        "days": int((rows["day"].iloc[-1] - rows["day"].iloc[0]).days + 1),
        "maxScore": None if pd.isna(max_score) else round(float(max_score), 4),
        "parameters": sorted(counts, key=lambda p: -counts[p])[:3],
    }


def evaluate(flags: pd.DataFrame, events: list[dict]) -> dict | None:
    """Quantos eventos conhecidos tiveram pelo menos um dia anômalo marcado (com 2 dias de folga)."""
    if not events or flags.empty:
        return None
    days = pd.to_datetime(flags["date"])
    tol = pd.Timedelta(days=EVENT_TOLERANCE_DAYS)
    known = detected = 0
    for ev in events:
        station = flags["stationId"] == ev["stationId"]
        start, end = pd.Timestamp(ev["start"]), pd.Timestamp(ev["end"])
        if not station.any() or end < days[station].min() or start > days[station].max():
            continue
        known += 1
        window = station & days.between(start - tol, end + tol)
        detected += bool(flags.loc[window, "anomaly"].any())
    if known == 0:
        return None
    return {"knownEvents": known, "detected": detected, "recall": round(detected / known, 4)}
