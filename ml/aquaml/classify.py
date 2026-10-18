"""Classificação da condição ambiental (classe do IQA) a partir dos sensores.

Um Random Forest aprende a reconhecer a classe de qualidade diretamente das
leituras brutas. Diferente do cálculo do IQA, o modelo continua funcionando
quando algum sensor falha (valores ausentes são imputados), o que é avaliado
explicitamente no conjunto de teste.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score
from sklearn.pipeline import make_pipeline

from . import IQA_CLASSES, PARAMS, transform

SPLIT_DATE = "2026-04-01"


def train_and_evaluate(df: pd.DataFrame, seed: int = 0) -> dict:
    data = df.dropna(subset=["iqa_class"]).sort_values("date")
    X = transform(data, PARAMS)
    y = data["iqa_class"]
    train = data["date"] < SPLIT_DATE
    test = ~train

    model = make_pipeline(
        SimpleImputer(strategy="median"),
        RandomForestClassifier(n_estimators=300, min_samples_leaf=2, class_weight="balanced",
                               random_state=seed, n_jobs=-1),
    )
    model.fit(X[train], y[train])
    pred = model.predict(X[test])

    labels = [c for c in IQA_CLASSES if c in set(y)]
    rng = np.random.default_rng(seed)
    X_masked = X[test].to_numpy(dtype=float, copy=True)
    drop = rng.integers(0, len(PARAMS), len(X_masked))
    X_masked[np.arange(len(X_masked)), drop] = np.nan
    pred_masked = model.predict(pd.DataFrame(X_masked, columns=PARAMS, index=X[test].index))

    rf = model.named_steps["randomforestclassifier"]
    importance = sorted(
        ({"feature": p, "importance": round(float(v), 4)} for p, v in zip(PARAMS, rf.feature_importances_)),
        key=lambda d: -d["importance"],
    )

    # Condição atual de cada estação segundo o modelo (último dia disponível).
    latest = df.sort_values("date").groupby("station_id").tail(1)
    proba = model.predict_proba(transform(latest, PARAMS))
    current = {
        row.station_id: {
            "date": row.date,
            "predicted": model.classes_[i_max],
            "confidence": round(float(p[i_max]), 3),
        }
        for row, p, i_max in zip(latest.itertuples(), proba, proba.argmax(axis=1))
    }

    return {
        "model": "RandomForestClassifier",
        "train_period": [str(data.loc[train, "date"].min()), str(data.loc[train, "date"].max())],
        "test_period": [str(data.loc[test, "date"].min()), str(data.loc[test, "date"].max())],
        "n_train": int(train.sum()),
        "n_test": int(test.sum()),
        "accuracy": round(float(accuracy_score(y[test], pred)), 4),
        "f1_macro": round(float(f1_score(y[test], pred, average="macro", labels=labels, zero_division=0)), 4),
        "accuracy_one_sensor_missing": round(float(accuracy_score(y[test], pred_masked)), 4),
        "labels": labels,
        "confusion_matrix": confusion_matrix(y[test], pred, labels=labels).tolist(),
        "feature_importance": importance,
        "current": current,
    }
