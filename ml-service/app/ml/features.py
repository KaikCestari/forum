"""Preparação dos dados para os algoritmos de machine learning.

Parâmetros como coliformes ou turbidez variam em ordens de grandeza
(10, 100, 10.000...). Para os algoritmos não darem importância exagerada
aos valores gigantes, eles são analisados em escala logarítmica (log10),
como os biólogos já fazem em gráficos de coliformes.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.domain.parameters import BY_KEY

RANDOM_STATE = 42  # semente fixa: o mesmo dado sempre gera o mesmo resultado


def log_transform(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    """Copia as colunas pedidas aplicando log10 às de distribuição assimétrica."""
    out = df[columns].astype(float).copy()
    for col in columns:
        if col in BY_KEY and BY_KEY[col].log_scale:
            out[col] = np.log10(out[col].clip(lower=1e-3))
    return out


def available_columns(df: pd.DataFrame, columns: list[str], min_fraction: float = 0.0) -> list[str]:
    """Colunas que têm dados (pelo menos `min_fraction` das linhas preenchidas)."""
    if df.empty:
        return []
    return [c for c in columns if c in df and df[c].notna().mean() > min_fraction]
