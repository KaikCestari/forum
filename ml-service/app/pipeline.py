from __future__ import annotations

import math
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from app.api.schemas import AnalysisResult, AnalyzeRequest
from app.domain import alerts as alert_rules
from app.domain import iqa
from app.domain.cleaning import build_daily_table
from app.domain.parameters import PARAM_KEYS, describe_all, label
from app.ml import anomaly, classification, clustering, trends

RECENT_DAYS = 30  # janela de "recente" (alertas e IQA dos últimos 30 dias)


def analyze(request: AnalyzeRequest) -> AnalysisResult:
    stations = _station_catalog(request)
    measurements = pd.DataFrame(
        [m.model_dump(by_alias=True) for m in request.measurements],
        columns=["timestamp", "stationId", *PARAM_KEYS],
    )

    daily, report = build_daily_table(measurements)
    daily = iqa.add_iqa_columns(daily)
    for station_id in daily["stationId"].unique():
        stations.setdefault(station_id, {"name": station_id, "type": "rio"})

    flags, forest_ran = anomaly.detect(daily)
    events = [{"stationId": e.station_id, "start": e.start.isoformat(),
               "end": (e.end or e.start).isoformat()} for e in request.events]
    anomalies = {
        "method": anomaly.METHOD if forest_ran
        else f"{anomaly.METHOD} — poucos dias para o Isolation Forest, só z-score",
        "episodes": anomaly.episodes(flags),
        "evaluation": anomaly.evaluate(flags, events),
    }
    clf = classification.train_and_evaluate(daily)
    clus = clustering.cluster(daily)
    trend_list = trends.analyze(daily)
    alert_list = alert_rules.build_alerts(daily, {k: v["type"] for k, v in stations.items()})

    period_end = daily["date"].max()
    summaries = _station_summaries(daily, stations, clf, clus, trend_list, alert_list, period_end)
    result = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "period": {"start": daily["date"].min(), "end": period_end},
        "parameters": describe_all(),
        "processing": report.as_dict(),
        "stations": summaries,
        "insights": _insights(daily, report, summaries, anomalies, clf, clus, trend_list,
                              alert_list),
        "alerts": alert_list,
        "anomalies": anomalies,
        "classification": clf,
        "clusters": {k: clus[k] for k in ("method", "points", "profiles")},
        "trends": trend_list,
        "series": _series(daily, flags),
    }
    return AnalysisResult.model_validate(sanitize(result))


def _station_catalog(request: AnalyzeRequest) -> dict[str, dict]:
    return {s.id: {"name": s.name or s.id, "type": s.type or "rio"} for s in request.stations}


def _recent_start(end: str) -> str:
    return (pd.Timestamp(end) - pd.Timedelta(days=RECENT_DAYS - 1)).strftime("%Y-%m-%d")


def _station_summaries(daily, stations, clf, clus, trend_list, alert_list, period_end) -> list[dict]:
    recent_from = _recent_start(period_end)
    out = []
    for station_id, days in daily.groupby("stationId", sort=True):
        days = days.sort_values("date")
        with_iqa = days.dropna(subset=["iqa"])
        latest = None
        if not with_iqa.empty:
            last = with_iqa.iloc[-1]
            latest = {"date": last["date"], "iqa": round(float(last["iqa"]), 2),
                      "iqaClass": last["iqaClass"]}
        st_alerts = [a for a in alert_list if a["stationId"] == station_id]
        cluster_id = clus["latest"].get(station_id)
        out.append({
            "stationId": station_id,
            "name": stations[station_id]["name"],
            "type": stations[station_id]["type"],
            "latest": latest,
            "iqaPeriod": round(float(with_iqa["iqa"].mean()), 2) if not with_iqa.empty else None,
            "predictedClass": clf["current"].get(station_id),
            "cluster": cluster_id,
            "clusterLabel": clus["labels"].get(cluster_id) if cluster_id is not None else None,
            "worseningTrends": [t["parameter"] for t in trend_list
                                if t["stationId"] == station_id and t["direction"] == "piora"],
            "alertsTotal": len(st_alerts),
            "alertsRecent": sum(a["date"] >= recent_from for a in st_alerts),
            "criticalTotal": sum(a["severity"] == "critico" for a in st_alerts),
        })
    return out


def _insights(daily, report, summaries, anomalies, clf, clus, trend_list, alert_list) -> list[str]:
    """Frases curtas, em linguagem simples, para o painel."""
    names = {s["stationId"]: s["name"] for s in summaries}
    out = [f"Foram analisados {report.days} dias de {len(summaries)} estação(ões), "
           f"de {_br_date(daily['date'].min())} a {_br_date(daily['date'].max())}."]
    if report.discarded_days:
        out.append(f"{report.discarded_days} dia(s) ficaram de fora por terem menos de 6 leituras.")

    recent = daily[daily["date"] >= _recent_start(daily["date"].max())].dropna(subset=["iqa"])
    iqa_recent = recent.groupby("stationId")["iqa"].mean().sort_values()
    if iqa_recent.empty:
        out.append("Não foi possível calcular o IQA: são necessários pelo menos 5 destes 7 "
                   "parâmetros no mesmo dia — oxigênio e temperatura, coliformes, pH, nitrato, "
                   "fósforo e turbidez.")
    elif len(iqa_recent) == 1:
        sid, value = iqa_recent.index[0], iqa_recent.iloc[0]
        out.append(f"IQA médio de {names[sid]} nos últimos 30 dias: {value:.0f} "
                   f"({iqa.classify(value)}).")
    else:
        worst, best = iqa_recent.index[0], iqa_recent.index[-1]
        out.append(f"Melhor qualidade nos últimos 30 dias: {names[best]} (IQA médio "
                   f"{iqa_recent.iloc[-1]:.0f}); pior: {names[worst]} (IQA médio "
                   f"{iqa_recent.iloc[0]:.0f}).")

    critical = [a for a in alert_list if a["severity"] == "critico"]
    if critical:
        counts = pd.Series([a["stationId"] for a in critical]).value_counts()
        out.append(f"{len(critical)} alerta(s) crítico(s) pelos limites da CONAMA 357, "
                   f"a maioria em {names[counts.index[0]]}.")
    elif alert_list:
        out.append(f"{len(alert_list)} alerta(s) de atenção pelos limites da CONAMA 357, "
                   "nenhum crítico.")
    else:
        out.append("Nenhum parâmetro passou dos limites da CONAMA 357 no período.")

    worsening: dict[str, list[str]] = {}
    for t in trend_list:
        if t["direction"] == "piora":
            worsening.setdefault(t["stationId"], []).append(label(t["parameter"]).lower())
    if worsening:
        parts = [f"{names[s]} ({', '.join(v)})" for s, v in worsening.items()]
        out.append("Tendência de piora ao longo do tempo: " + "; ".join(parts) + ".")

    n_eps = len(anomalies["episodes"])
    if n_eps:
        out.append(f"A IA encontrou {n_eps} episódio(s) de dias fora do padrão.")
    ev = anomalies["evaluation"]
    if ev:
        out.append(f"Dos {ev['knownEvents']} evento(s) registrados em campo, a IA detectou "
                   f"{ev['detected']}.")

    if clf["accuracy"] is not None:
        out.append(f"O modelo reconhece a classe de qualidade da água com "
                   f"{clf['accuracy']:.0%} de acerto em dias que não viu no treino.")
    if clf["featureImportance"]:
        top = clf["featureImportance"][0]["feature"]
        out.append(f"O parâmetro que mais pesa na qualidade da água é {label(top).lower()}.")

    if clus["labels"]:
        worst_cluster = max(clus["labels"])
        impacted = [names[s] for s, c in clus["latest"].items() if c == worst_cluster]
        if impacted:
            out.append(f"Perfil atual \"{clus['labels'][worst_cluster]}\": "
                       + ", ".join(impacted) + ".")
    return out


def _br_date(iso: str) -> str:
    y, m, d = iso.split("-")
    return f"{d}/{m}/{y}"


def _series(daily: pd.DataFrame, flags: pd.DataFrame) -> dict[str, dict]:
    """Séries diárias de cada estação, prontas para os gráficos."""
    merged = daily.merge(flags[["stationId", "date", "anomaly", "score"]],
                         on=["stationId", "date"], how="left")
    out = {}
    for station_id, g in merged.sort_values("date").groupby("stationId", sort=True):
        out[station_id] = {
            "dates": g["date"].tolist(),
            "iqa": g["iqa"].round(2).tolist(),
            "iqaClass": g["iqaClass"].tolist(),
            "anomaly": g["anomaly"].fillna(False).astype(bool).tolist(),
            "anomalyScore": g["score"].astype(float).round(4).tolist(),
            "params": {p: g[p].round(4).tolist() for p in PARAM_KEYS},
        }
    return out


def sanitize(obj):
    """Garante JSON válido: NaN/infinito viram None e tipos numpy viram Python."""
    if isinstance(obj, dict):
        return {str(k) if isinstance(k, np.generic) else k: sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitize(v) for v in obj]
    if isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (float, np.floating)):
        value = float(obj)
        return None if math.isnan(value) or math.isinf(value) else value
    if obj is pd.NaT or obj is pd.NA:
        return None
    return obj
