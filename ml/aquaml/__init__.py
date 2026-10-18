"""AquaML: módulos de IA/ML para análise de ecossistemas aquáticos."""

from __future__ import annotations

import numpy as np
import pandas as pd

PARAMS = ["ph", "do_mgl", "temp_c", "turbidity_ntu", "conductivity_uscm",
          "nitrate_mgl", "phosphorus_mgl", "coliforms_nmp"]

# Parâmetros com distribuição assimétrica, analisados em escala log.
LOG_PARAMS = {"turbidity_ntu", "conductivity_uscm", "nitrate_mgl", "phosphorus_mgl", "coliforms_nmp"}

LABELS = {
    "ph": ("pH", ""),
    "do_mgl": ("Oxigênio dissolvido", "mg/L"),
    "temp_c": ("Temperatura", "°C"),
    "turbidity_ntu": ("Turbidez", "NTU"),
    "conductivity_uscm": ("Condutividade", "µS/cm"),
    "nitrate_mgl": ("Nitrato", "mg/L"),
    "phosphorus_mgl": ("Fósforo total", "mg/L"),
    "coliforms_nmp": ("Coliformes", "NMP/100mL"),
    "do_sat_pct": ("Saturação de OD", "%"),
    "iqa": ("IQA", ""),
}

# +1: aumento piora a qualidade; -1: redução piora; 0: depende do contexto.
WORSE_DIRECTION = {
    "ph": 0, "do_mgl": -1, "temp_c": 1, "turbidity_ntu": 1, "conductivity_uscm": 1,
    "nitrate_mgl": 1, "phosphorus_mgl": 1, "coliforms_nmp": 1, "iqa": -1,
}

IQA_CLASSES = ["Ótima", "Boa", "Regular", "Ruim", "Péssima"]


def label(param: str) -> str:
    return LABELS.get(param, (param, ""))[0]


def unit(param: str) -> str:
    return LABELS.get(param, ("", ""))[1]


def transform(df: pd.DataFrame, params: list[str]) -> pd.DataFrame:
    """Aplica log10 aos parâmetros assimétricos."""
    out = df[params].copy()
    for p in params:
        if p in LOG_PARAMS:
            out[p] = np.log10(out[p].clip(lower=1e-3))
    return out
