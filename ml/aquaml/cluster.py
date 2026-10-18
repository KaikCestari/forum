"""Identificação de padrões: agrupa perfis mensais das estações (K-Means + PCA)."""

from __future__ import annotations

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

from . import transform

# Temperatura e condutividade ficam de fora: dominariam os grupos por estação do
# ano ou pela salinidade do estuário, e não pelo grau de impacto ambiental.
FEATURES = ["ph", "do_sat_pct", "turbidity_ntu", "nitrate_mgl", "phosphorus_mgl", "coliforms_nmp"]
NAMES = ["Preservado", "Intermediário", "Impactado", "Muito impactado"]


def monthly_profiles(df: pd.DataFrame) -> pd.DataFrame:
    d = df.assign(month=pd.to_datetime(df["date"]).dt.strftime("%Y-%m"))
    return d.groupby(["station_id", "month"])[FEATURES + ["iqa"]].mean().dropna().reset_index()


def cluster(df: pd.DataFrame, k: int = 3, seed: int = 0) -> dict:
    prof = monthly_profiles(df)
    X = StandardScaler().fit_transform(transform(prof, FEATURES))
    km = KMeans(n_clusters=k, n_init=20, random_state=seed).fit(X)
    pca = PCA(n_components=2, random_state=seed).fit(X)
    xy = pca.transform(X)
    prof["cluster_raw"] = km.labels_

    # Nomeia os grupos pela qualidade média (maior IQA = mais preservado).
    order = prof.groupby("cluster_raw")["iqa"].mean().sort_values(ascending=False).index
    rename = {c: i for i, c in enumerate(order)}
    prof["cluster"] = prof["cluster_raw"].map(rename)

    profiles = []
    for c, g in prof.groupby("cluster"):
        profiles.append({
            "cluster": int(c),
            "label": NAMES[c] if c < len(NAMES) else f"Grupo {c + 1}",
            "months": int(len(g)),
            "stations": sorted(g["station_id"].unique().tolist()),
            "mean": {f: round(float(g[f].mean()), 4) for f in FEATURES + ["iqa"]},
        })

    points = [
        {"station_id": r.station_id, "month": r.month, "x": round(float(x), 3),
         "y": round(float(y), 3), "cluster": int(r.cluster), "iqa": round(float(r.iqa), 1)}
        for r, (x, y) in zip(prof.itertuples(), xy)
    ]
    # Grupo do mês mais recente de cada estação + mudanças de grupo ao longo do tempo.
    latest = prof.sort_values("month").groupby("station_id").tail(1)
    transitions = []
    for sid, g in prof.sort_values("month").groupby("station_id"):
        prev = None
        for r in g.itertuples():
            if prev is not None and r.cluster != prev:
                transitions.append({"station_id": sid, "month": r.month,
                                    "from": int(prev), "to": int(r.cluster)})
            prev = r.cluster

    return {
        "k": k,
        "features": FEATURES,
        "explained_variance": [round(float(v), 3) for v in pca.explained_variance_ratio_],
        "profiles": profiles,
        "points": points,
        "latest": {r.station_id: int(r.cluster) for r in latest.itertuples()},
        "transitions": transitions,
    }
