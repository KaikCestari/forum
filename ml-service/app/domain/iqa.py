"""IQA — Índice de Qualidade das Águas (versão simplificada do IQA-CETESB/NSF).

O que é: uma nota de 0 a 100 que resume vários parâmetros num único número,
fácil de comparar entre rios, lagos e datas. Quanto maior, melhor a água.

Como funciona:
1. Cada parâmetro vira uma "nota de qualidade" q (0 a 100) por meio de uma
   curva. Exemplo: oxigênio perto de 100% de saturação recebe q≈100; água
   quase sem oxigênio recebe q≈2.
2. As notas são combinadas por um produtório ponderado: IQA = ∏ qᵢ^wᵢ.
   O produtório faz um parâmetro muito ruim derrubar o índice inteiro,
   como acontece na natureza (pouco oxigênio mata peixes mesmo com o resto bom).

O IQA original usa nove parâmetros. Aqui DBO e sólidos totais não são medidos,
então usamos os sete disponíveis e redistribuímos os pesos. Exigimos pelo menos
5 dos 7 parâmetros no dia; com menos, o IQA fica vazio (não inventamos nota).

As curvas são aproximações lineares por partes das curvas da NSF e são
idênticas às do antigo processador em Rust (`processor/src/iqa.rs`).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# Curvas de qualidade: pontos (x, q). Entre pontos, interpolação linear;
# fora da tabela, o valor da ponta (saturação), igual ao Rust.
CURVE_DO_SAT = [(0, 2), (20, 12), (40, 30), (60, 56), (80, 85), (100, 100),
                (120, 90), (140, 70), (160, 55), (200, 40)]
CURVE_COLIFORMS_LOG = [(0, 100), (1, 80), (2, 55), (3, 30), (4, 15), (5, 5), (6, 3)]
CURVE_PH = [(2, 2), (3, 4), (4, 10), (5, 25), (6, 55), (7, 90), (7.5, 92),
            (8, 82), (9, 55), (10, 25), (11, 10), (12, 3)]
CURVE_TEMP_DEV = [(0, 93), (5, 72), (10, 45), (15, 25), (20, 10)]
CURVE_NITROGEN = [(0, 100), (5, 75), (10, 52), (20, 30), (50, 10), (100, 2)]
CURVE_PHOSPHORUS = [(0, 100), (0.1, 90), (0.5, 60), (1, 45), (2, 30), (5, 10), (10, 2)]
CURVE_TURBIDITY = [(0, 100), (10, 78), (25, 60), (50, 42), (100, 18), (150, 5)]

# Pesos da NSF para os 7 parâmetros disponíveis (renormalizados no cálculo).
WEIGHTS = {
    "do_sat_pct": 0.17,
    "coliforms": 0.15,
    "ph": 0.12,
    "temp_dev": 0.10,
    "nitrogen": 0.10,
    "phosphorus": 0.10,
    "turbidity": 0.08,
}
MIN_PARAMS = 5

# Classes CETESB: (limite inferior, nome), da melhor para a pior.
CLASSES = [(80.0, "Ótima"), (52.0, "Boa"), (37.0, "Regular"), (20.0, "Ruim")]
WORST_CLASS = "Péssima"
CLASS_ORDER = ["Ótima", "Boa", "Regular", "Ruim", "Péssima"]


def _curve(points, x):
    xs, ys = zip(*points)
    return np.interp(x, xs, ys)


def do_saturation(temp_c):
    """Oxigênio dissolvido de saturação (mg/L) em água doce, conforme a temperatura."""
    t = np.asarray(temp_c, dtype=float)
    return 14.652 - 0.41022 * t + 0.007991 * t**2 - 0.000077774 * t**3


def q_do_sat(pct):
    return _curve(CURVE_DO_SAT, pct)


def q_coliforms(nmp):
    return _curve(CURVE_COLIFORMS_LOG, np.log10(np.maximum(nmp, 1.0)))


def q_ph(ph):
    return _curve(CURVE_PH, ph)


def q_temp_dev(dev):
    """`dev` = diferença entre a temperatura do dia e a média recente (°C)."""
    return _curve(CURVE_TEMP_DEV, np.abs(dev))


def q_nitrogen(mgl):
    return _curve(CURVE_NITROGEN, mgl)


def q_phosphorus(mgl):
    return _curve(CURVE_PHOSPHORUS, mgl)


def q_turbidity(ntu):
    return _curve(CURVE_TURBIDITY, ntu)


Q_FUNCTIONS = {
    "do_sat_pct": q_do_sat,
    "coliforms": q_coliforms,
    "ph": q_ph,
    "temp_dev": q_temp_dev,
    "nitrogen": q_nitrogen,
    "phosphorus": q_phosphorus,
    "turbidity": q_turbidity,
}


def compute_many(inputs: dict[str, np.ndarray]) -> np.ndarray:
    """IQA para vários dias de uma vez. `inputs` tem um vetor por termo do IQA
    (chaves de WEIGHTS); NaN = parâmetro indisponível naquele dia.
    Devolve NaN nos dias com menos de 5 parâmetros."""
    n = len(next(iter(inputs.values())))
    log_sum = np.zeros(n)
    weight_sum = np.zeros(n)
    available = np.zeros(n, dtype=int)
    for name, weight in WEIGHTS.items():
        x = np.asarray(inputs.get(name, np.full(n, np.nan)), dtype=float)
        ok = np.isfinite(x)
        q = np.where(ok, Q_FUNCTIONS[name](np.where(ok, x, 0.0)), 1.0)
        log_sum += np.where(ok, weight * np.log(np.maximum(q, 1.0)), 0.0)
        weight_sum += np.where(ok, weight, 0.0)
        available += ok
    with np.errstate(invalid="ignore", divide="ignore"):
        iqa = np.exp(log_sum / weight_sum)
    return np.where(available >= MIN_PARAMS, iqa, np.nan)


def compute(do_sat_pct=None, coliforms=None, ph=None, temp_dev=None,
            nitrogen=None, phosphorus=None, turbidity=None) -> float | None:
    """IQA de um único dia (None = parâmetro indisponível)."""
    values = dict(do_sat_pct=do_sat_pct, coliforms=coliforms, ph=ph, temp_dev=temp_dev,
                  nitrogen=nitrogen, phosphorus=phosphorus, turbidity=turbidity)
    arrays = {k: np.array([np.nan if v is None else v], dtype=float) for k, v in values.items()}
    result = float(compute_many(arrays)[0])
    return None if np.isnan(result) else result


def classify(iqa: float | None) -> str | None:
    """Classe CETESB do IQA: Ótima (≥80), Boa (≥52), Regular (≥37), Ruim (≥20), Péssima."""
    if iqa is None or not np.isfinite(iqa):
        return None
    for lower, name in CLASSES:
        if iqa >= lower:
            return name
    return WORST_CLASS


def add_iqa_columns(daily: pd.DataFrame) -> pd.DataFrame:
    """Acrescenta à tabela diária: saturação de OD (%), IQA e classe do IQA.

    Espera as colunas dos parâmetros e `tempRef` (média móvel de 30 dias da
    temperatura, referência para o termo de variação térmica)."""
    out = daily.copy()
    out["doSatPct"] = out["doMgl"] / do_saturation(out["tempC"]) * 100.0
    out["iqa"] = compute_many({
        "do_sat_pct": out["doSatPct"].to_numpy(dtype=float),
        "coliforms": out["coliformsNmp"].to_numpy(dtype=float),
        "ph": out["ph"].to_numpy(dtype=float),
        "temp_dev": (out["tempC"] - out["tempRef"]).to_numpy(dtype=float),
        "nitrogen": out["nitrateMgl"].to_numpy(dtype=float),
        "phosphorus": out["phosphorusMgl"].to_numpy(dtype=float),
        "turbidity": out["turbidityNtu"].to_numpy(dtype=float),
    })
    out["iqaClass"] = [classify(v) for v in out["iqa"]]
    return out
