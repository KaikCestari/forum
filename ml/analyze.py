"""Etapa de IA/ML do AquaML.

Lê os dados diários processados pelo Rust e produz `results.json` com:
anomalias, classificação da condição ambiental, padrões (clusters),
tendências, alertas e um resumo para tomada de decisão.

Uso: python analyze.py --processed ../data/processed --raw ../data/raw --out ../data/results/results.json
"""

from __future__ import annotations

import argparse
import json
import math
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from aquaml import PARAMS, alerts, anomaly, classify, cluster, label, trends

ROOT = Path(__file__).resolve().parent.parent
SERIES_FIELDS = PARAMS + ["do_sat_pct", "iqa"]


def clean_json(obj):
    """Converte NaN/inf em null para gerar JSON válido."""
    if isinstance(obj, float):
        return None if math.isnan(obj) or math.isinf(obj) else round(obj, 4)
    if isinstance(obj, dict):
        return {k: clean_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [clean_json(v) for v in obj]
    return obj


def build_series(df: pd.DataFrame, flags: pd.DataFrame) -> dict:
    merged = df.merge(flags[["station_id", "date", "anomaly", "score"]], on=["station_id", "date"], how="left")
    series = {}
    for sid, g in merged.groupby("station_id", sort=True):
        g = g.sort_values("date")
        series[sid] = {
            "dates": g["date"].tolist(),
            **{f: g[f].round(4).tolist() for f in SERIES_FIELDS},
            **{f"{f}_ma7": g[f"{f}_ma7"].round(4).tolist() for f in PARAMS},
            "iqa_class": g["iqa_class"].fillna("").tolist(),
            "anomaly": g["anomaly"].fillna(False).astype(bool).tolist(),
            "anomaly_score": g["score"].round(4).tolist(),
        }
    return series


def station_summaries(df, stations, clf, clus, trend_list, alert_list) -> list[dict]:
    out = []
    for sid, st in stations.items():
        g = df[df["station_id"] == sid].sort_values("date")
        last = g.dropna(subset=["iqa"]).iloc[-1]
        last30 = g.tail(30)
        worsening = [t["label"] for t in trend_list if t["station_id"] == sid and t["verdict"] == "piora"]
        st_alerts = [a for a in alert_list if a["station_id"] == sid]
        recent = [a for a in st_alerts if a["end"] >= str(last30["date"].iloc[0])]
        cluster_id = clus["latest"].get(sid)
        out.append({
            **st,
            "latest": {"date": last["date"], "iqa": float(last["iqa"]), "iqa_class": last["iqa_class"],
                       **{p: float(last[p]) for p in PARAMS if pd.notna(last[p])}},
            "iqa_30d": float(last30["iqa"].mean()),
            "iqa_period": float(g["iqa"].mean()),
            "predicted": clf["current"].get(sid),
            "cluster": cluster_id,
            "cluster_label": next((p["label"] for p in clus["profiles"] if p["cluster"] == cluster_id), None),
            "worsening_trends": worsening,
            "alerts_total": len(st_alerts),
            "alerts_recent": len(recent),
            "critical_total": sum(a["severity"] == "critico" for a in st_alerts),
        })
    return out


def insights(summaries, ev, clf, trend_list, clus) -> list[str]:
    """Frases-resumo para o painel de decisão."""
    out = []
    worst = min(summaries, key=lambda s: s["iqa_30d"])
    best = max(summaries, key=lambda s: s["iqa_30d"])
    out.append(f"Melhor condição nos últimos 30 dias: {best['name']} (IQA médio {best['iqa_30d']:.0f}); "
               f"pior: {worst['name']} (IQA médio {worst['iqa_30d']:.0f}).")
    piora = [t for t in trend_list if t["verdict"] == "piora"]
    if piora:
        by_station: dict[str, list[str]] = {}
        for t in piora:
            by_station.setdefault(t["station_id"], []).append(t["label"].lower())
        names = {s["id"]: s["name"] for s in summaries}
        parts = [f"{names[s]} ({', '.join(v)})" for s, v in by_station.items()]
        out.append("Tendências significativas de piora: " + "; ".join(parts) + ".")
    if ev:
        out.append(f"A detecção de anomalias identificou {sum(e['detected'] for e in ev['events'])} de "
                   f"{len(ev['events'])} eventos ambientais conhecidos (precisão diária de "
                   f"{ev['day_precision']:.0%}).")
    out.append(f"O classificador reconhece a classe de qualidade da água com {clf['accuracy']:.0%} de acurácia "
               f"em dados futuros, e {clf['accuracy_one_sensor_missing']:.0%} mesmo com um sensor ausente.")
    impacted = [s["name"] for s in summaries if s["cluster"] is not None and s["cluster"] == clus["k"] - 1]
    if impacted:
        out.append("Perfil atual classificado como mais impactado: " + ", ".join(impacted) + ".")
    top = clf["feature_importance"][0]
    out.append(f"O parâmetro mais determinante para a condição ambiental é {label(top['feature']).lower()}.")
    return out


def run(processed: Path, raw: Path, out: Path) -> dict:
    timings = {}
    t0 = time.perf_counter()
    df = pd.read_csv(processed / "processed.csv", dtype={"station_id": str, "date": str})
    stations_df = pd.read_csv(raw / "stations.csv")
    stations = {r["id"]: r for r in stations_df.to_dict("records")}
    events_path = raw / "events.csv"
    events = pd.read_csv(events_path) if events_path.exists() else None
    summary_path = processed / "summary.json"
    processing = json.loads(summary_path.read_text()) if summary_path.exists() else None
    timings["load"] = time.perf_counter() - t0

    t = time.perf_counter()
    flags = anomaly.detect(df)
    eps = anomaly.episodes(flags)
    ev = anomaly.evaluate(flags, events) if events is not None else None
    timings["anomaly"] = time.perf_counter() - t

    t = time.perf_counter()
    clf = classify.train_and_evaluate(df)
    timings["classification"] = time.perf_counter() - t

    t = time.perf_counter()
    clus = cluster.cluster(df)
    timings["clustering"] = time.perf_counter() - t

    t = time.perf_counter()
    trend_list = trends.analyze(df)
    timings["trends"] = time.perf_counter() - t

    t = time.perf_counter()
    alert_list = alerts.build(df, stations, eps, trend_list)
    summaries = station_summaries(df, stations, clf, clus, trend_list, alert_list)
    timings["alerts"] = time.perf_counter() - t

    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "period": [df["date"].min(), df["date"].max()],
        "parameters": {p: {"label": label(p), "unit": alerts.unit(p)} for p in SERIES_FIELDS},
        "processing": processing,
        "stations": summaries,
        "insights": insights(summaries, ev, clf, trend_list, clus),
        "alerts": alert_list,
        "anomalies": {
            "method": "IsolationForest + z-score (30 dias)",
            "episodes": eps,
            "evaluation": ev,
        },
        "classification": clf,
        "clusters": clus,
        "trends": trend_list,
        "series": build_series(df, flags),
        "timings_s": {k: round(v, 3) for k, v in timings.items()},
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(clean_json(result), ensure_ascii=False, default=str))
    return result


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--processed", type=Path, default=ROOT / "data/processed")
    ap.add_argument("--raw", type=Path, default=ROOT / "data/raw")
    ap.add_argument("--out", type=Path, default=ROOT / "data/results/results.json")
    args = ap.parse_args()
    t0 = time.perf_counter()
    r = run(args.processed, args.raw, args.out)
    print(f"analyze: {len(r['alerts'])} alertas, {len(r['anomalies']['episodes'])} episódios anômalos, "
          f"acurácia {r['classification']['accuracy']:.1%} em {time.perf_counter() - t0:.1f}s → {args.out}")
