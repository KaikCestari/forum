from __future__ import annotations

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score
from sklearn.pipeline import make_pipeline

from app.domain.parameters import PARAM_KEYS

from .features import RANDOM_STATE, available_columns, log_transform

METHOD = "Random Forest"
MIN_LABELED_DAYS = 30     # dias com IQA necessários para treinar
TRAIN_FRACTION = 0.75     # parte inicial do período usada no treino


def skipped(reason: str) -> dict:
    return {"method": f"{METHOD} (não executado: {reason})", "accuracy": None,
            "featureImportance": [], "current": {}}


def _new_model():
    return make_pipeline(
        SimpleImputer(strategy="median"),
        RandomForestClassifier(n_estimators=200, min_samples_leaf=2, class_weight="balanced",
                               random_state=RANDOM_STATE, n_jobs=-1),
    )


def _time_split(data: pd.DataFrame) -> pd.Series:
    """Verdadeiro para os dias de treino (início do período), falso para os de teste."""
    dates = sorted(data["date"].unique())
    cutoff = dates[int(len(dates) * TRAIN_FRACTION)] if len(dates) > 1 else dates[0]
    return data["date"] < cutoff


def train_and_evaluate(daily: pd.DataFrame) -> dict:
    labeled = daily.dropna(subset=["iqaClass"])
    features = available_columns(labeled, PARAM_KEYS)
    if len(labeled) < MIN_LABELED_DAYS or not features:
        return skipped(f"são necessários pelo menos {MIN_LABELED_DAYS} dias com IQA calculado")
    if labeled["iqaClass"].nunique() < 2:
        return skipped("todos os dias têm a mesma classe de qualidade")

    X, y = log_transform(labeled, features), labeled["iqaClass"]
    train = _time_split(labeled)
    accuracy = None
    if y[train].nunique() >= 2 and (~train).any():
        model = _new_model().fit(X[train], y[train])
        accuracy = round(float(accuracy_score(y[~train], model.predict(X[~train]))), 4)

    model = _new_model().fit(X, y)
    forest = model.named_steps["randomforestclassifier"]
    importance = sorted(
        ({"feature": f, "importance": round(float(v), 4)}
         for f, v in zip(features, forest.feature_importances_)),
        key=lambda d: -d["importance"],
    )

    # Classe atual: último dia de cada estação (mesmo se faltar algum sensor).
    latest = daily.sort_values("date").groupby("stationId").tail(1)
    predicted = model.predict(log_transform(latest, features))
    current = {str(sid): str(cls) for sid, cls in zip(latest["stationId"], predicted)}

    return {"method": METHOD, "accuracy": accuracy, "featureImportance": importance,
            "current": current}
