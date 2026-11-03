"""Agrupamento de perfis de água (K-Means + PCA).

Para o biólogo: sem dizer ao algoritmo o que é água boa ou ruim, ele junta
os dias que "se parecem" (mesmo nível de oxigênio, nutrientes, coliformes...)
em 3 grupos. Depois damos nome aos grupos pela qualidade média (IQA): o grupo
de maior IQA vira "Água limpa e oxigenada", e assim por diante. Isso mostra,
por exemplo, que uma estação que era do grupo limpo passou para o impactado.

Técnicas:
- K-Means: escolhe 3 "centros" e coloca cada dia no grupo do centro mais
  próximo, ajustando os centros até estabilizar.
- PCA (análise de componentes principais): resume os vários parâmetros em
  2 eixos (x, y) para desenhar os dias num gráfico de pontos, mantendo o
  máximo possível das diferenças entre eles.

Temperatura e condutividade ficam de fora: separariam os dias pela estação
do ano ou pela salinidade do estuário, e não pelo grau de impacto ambiental.
Cada ponto do gráfico é um dia de uma estação.
"""

from __future__ import annotations

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

from app.domain.parameters import PARAM_KEYS

from .features import RANDOM_STATE, available_columns, log_transform

METHOD = "K-Means + PCA"
FEATURES = ["ph", "doSatPct", "turbidityNtu", "nitrateMgl", "phosphorusMgl", "coliformsNmp"]
N_CLUSTERS = 3
MIN_DAYS = 20
LABELS = {
    3: ["Água limpa e oxigenada", "Água com sinais de impacto", "Água muito impactada"],
    2: ["Água limpa e oxigenada", "Água com sinais de impacto"],
}


def skipped(reason: str) -> dict:
    return {"method": f"{METHOD} (não executado: {reason})", "points": [], "profiles": [],
            "latest": {}, "labels": {}}


def _order_clusters(days: pd.DataFrame, raw_labels) -> dict[int, int]:
    """Renumera os grupos do mais preservado (0) ao mais impactado,
    pelo IQA médio (ou pela saturação de oxigênio, se não houver IQA)."""
    by = "iqa" if days["iqa"].notna().any() else "doSatPct"
    means = days.assign(raw=raw_labels).groupby("raw")[by].mean()
    if means.isna().all():
        means = means.fillna(0)
    order = means.sort_values(ascending=False, na_position="last").index
    return {int(raw): new for new, raw in enumerate(order)}


def cluster(daily: pd.DataFrame) -> dict:
    features = available_columns(daily, FEATURES, min_fraction=0.5)
    if not features:
        return skipped("faltam parâmetros como oxigênio, fósforo ou coliformes")
    days = daily.dropna(subset=features).sort_values(["stationId", "date"])
    if len(days) < MIN_DAYS:
        return skipped(f"são necessários pelo menos {MIN_DAYS} dias completos")
    X = StandardScaler().fit_transform(log_transform(days, features))
    k = min(N_CLUSTERS, len(pd.DataFrame(X).drop_duplicates()))
    if k < 2:
        return skipped("todos os dias são iguais")

    kmeans = KMeans(n_clusters=k, n_init=10, random_state=RANDOM_STATE).fit(X)
    n_axes = min(2, len(features))
    xy = PCA(n_components=n_axes, random_state=RANDOM_STATE).fit_transform(X)
    rename = _order_clusters(days, kmeans.labels_)
    days = days.assign(cluster=[rename[int(c)] for c in kmeans.labels_],
                       x=xy[:, 0], y=xy[:, 1] if n_axes > 1 else 0.0)

    names = LABELS.get(k, [f"Grupo {i + 1}" for i in range(k)])
    params = available_columns(days, PARAM_KEYS)
    profiles = [{
        "cluster": int(c),
        "label": names[c],
        "size": int(len(g)),
        "means": {p: round(float(g[p].mean()), 4) for p in params if g[p].notna().any()},
    } for c, g in days.groupby("cluster")]

    points = [{"stationId": r.stationId, "date": r.date, "x": round(float(r.x), 3),
               "y": round(float(r.y), 3), "cluster": int(r.cluster)}
              for r in days.itertuples()]
    last = days.sort_values("date").groupby("stationId").tail(1)
    latest = {str(r.stationId): int(r.cluster) for r in last.itertuples()}
    return {"method": METHOD, "points": points, "profiles": profiles, "latest": latest,
            "labels": dict(enumerate(names))}
