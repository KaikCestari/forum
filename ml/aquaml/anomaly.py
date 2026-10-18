"""Detecção de anomalias multivariada (Isolation Forest + regra de z-score)."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from . import PARAMS, transform

BASELINE_DAYS = 60   # janela da linha de base móvel
BASELINE_LAG = 7     # defasagem, para o próprio evento não contaminar a base
Z_RULE = 4.0         # |z30| acima disso conta como desvio forte


def residual_features(station_df: pd.DataFrame) -> pd.DataFrame:
    """Desvio de cada parâmetro em relação à mediana móvel recente, em unidades
    robustas (MAD). Assim, mudanças lentas (sazonalidade, tendência) não são
    tratadas como anomalia; apenas alterações bruscas."""
    x = transform(station_df, PARAMS)
    base = x.shift(BASELINE_LAG).rolling(BASELINE_DAYS, min_periods=20).median()
    resid = x - base
    mad = (resid - resid.median()).abs().median() * 1.4826
    return resid / mad.replace(0, np.nan)


def detect(df: pd.DataFrame, contamination: float = 0.02, seed: int = 0) -> pd.DataFrame:
    """Retorna uma linha por (estação, dia) com score, flag e parâmetros mais desviantes."""
    out = []
    for sid, g in df.groupby("station_id", sort=True):
        g = g.sort_values("date")
        feats = residual_features(g)
        valid = feats.notna().sum(axis=1) >= 6
        X = feats[valid].fillna(0.0).clip(-15, 15)

        model = IsolationForest(n_estimators=300, contamination=contamination, random_state=seed)
        model.fit(X)
        score = pd.Series(np.nan, index=g.index)
        score[valid] = -model.score_samples(X)          # maior = mais anômalo
        if_flag = pd.Series(False, index=g.index)
        if_flag[valid] = model.predict(X) == -1

        z = g[[f"{p}_z30" for p in PARAMS]].abs()
        z_flag = (z > Z_RULE).sum(axis=1) >= 2

        absf = feats.abs()
        top = absf.apply(lambda r: [p for p in r.nlargest(3).index if r[p] > 2.5]
                         if r.notna().any() else [], axis=1)

        out.append(pd.DataFrame({
            "station_id": sid,
            "date": g["date"],
            "score": score,
            "if_flag": if_flag,
            "z_flag": z_flag,
            "anomaly": if_flag | z_flag,
            "top_params": top,
        }))
    return pd.concat(out, ignore_index=True)


def episodes(flags: pd.DataFrame, max_gap: int = 1) -> list[dict]:
    """Agrupa dias anômalos consecutivos (tolerando `max_gap` dias) em episódios."""
    eps = []
    for sid, g in flags[flags["anomaly"]].groupby("station_id"):
        dates = pd.to_datetime(g["date"]).sort_values()
        cur: list = []
        for d in dates:
            if cur and (d - cur[-1]).days > max_gap + 1:
                eps.append(_episode(sid, cur, g))
                cur = []
            cur.append(d)
        if cur:
            eps.append(_episode(sid, cur, g))
    return eps


def _episode(sid: str, dates: list, g: pd.DataFrame) -> dict:
    sel = g[pd.to_datetime(g["date"]).isin(dates)]
    counts: dict[str, int] = {}
    for tops in sel["top_params"]:
        for p in tops:
            counts[p] = counts.get(p, 0) + 1
    return {
        "station_id": sid,
        "start": dates[0].strftime("%Y-%m-%d"),
        "end": dates[-1].strftime("%Y-%m-%d"),
        "days": (dates[-1] - dates[0]).days + 1,
        "max_score": float(sel["score"].max()),
        "params": sorted(counts, key=counts.get, reverse=True)[:3],
    }


def evaluate(flags: pd.DataFrame, events: pd.DataFrame, tolerance: int = 2) -> dict:
    """Compara as anomalias com os eventos rotulados do conjunto sintético."""
    flags = flags.assign(date=pd.to_datetime(flags["date"]))
    in_event = pd.Series(False, index=flags.index)
    detected = []
    for ev in events.itertuples():
        start = pd.Timestamp(ev.start) - pd.Timedelta(days=tolerance)
        end = pd.Timestamp(ev.end) + pd.Timedelta(days=tolerance)
        mask = (flags["station_id"] == ev.station_id) & flags["date"].between(start, end)
        in_event |= mask
        hit = bool(flags.loc[mask, "anomaly"].any())
        detected.append({"station_id": ev.station_id, "start": ev.start, "end": ev.end,
                         "type": ev.type, "description": ev.description, "detected": hit})

    flagged = flags["anomaly"]
    tp = int((flagged & in_event).sum())
    precision = tp / max(int(flagged.sum()), 1)
    recall_days = tp / max(int(in_event.sum()), 1)
    event_recall = sum(d["detected"] for d in detected) / max(len(detected), 1)
    return {
        "event_recall": round(event_recall, 3),
        "day_precision": round(precision, 3),
        "day_recall": round(recall_days, 3),
        "anomalous_days": int(flagged.sum()),
        "events": detected,
    }
