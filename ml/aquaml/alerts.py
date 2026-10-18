"""Alertas em linguagem simples para apoio à tomada de decisão.

Combina limites da Resolução CONAMA 357/2005 (classe 2 de água doce; classe 1
de água salobra para o estuário) com os episódios anômalos detectados pelo
modelo e as tendências significativas de piora.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import pandas as pd

from . import label, unit

CHRONIC_FRACTION = 0.10  # fração de dias em violação que caracteriza situação recorrente


@dataclass
class Rule:
    category: str
    param: str
    title: str
    recommendation: str
    # Recebem (valores, tipo da estação) e devem retornar uma série booleana.
    limit: Callable[[pd.Series, str], pd.Series]
    acute: Callable[[pd.Series, str], pd.Series]
    limit_text: Callable[[str], str]


def _p_limit(stype: str) -> float:
    return {"lago": 0.03, "reservatorio": 0.03, "estuario": 0.124}.get(stype, 0.1)


def _ph_range(stype: str) -> tuple[float, float]:
    return (6.5, 8.5) if stype == "estuario" else (6.0, 9.0)


RULES = [
    Rule("hipoxia", "do_mgl", "Oxigênio dissolvido baixo",
         "Verificar fontes de matéria orgânica e risco de mortandade de peixes; "
         "considerar aeração ou restrição de lançamentos.",
         lambda v, t: v < 5.0, lambda v, t: v < 3.0, lambda t: "mínimo de 5 mg/L"),
    Rule("contaminacao_fecal", "coliforms_nmp", "Contaminação fecal",
         "Suspender usos de contato primário e investigar lançamentos de esgoto a montante.",
         lambda v, t: v > 1000, lambda v, t: v > 20000, lambda t: "máximo de 1000 NMP/100mL"),
    Rule("nutrientes", "phosphorus_mgl", "Excesso de fósforo",
         "Risco de eutrofização e floração de algas; rastrear fontes agrícolas e de esgoto.",
         lambda v, t: v > _p_limit(t), lambda v, t: v > 0.5,
         lambda t: f"máximo de {_p_limit(t)} mg/L".replace(".", ",")),
    Rule("nitrato", "nitrate_mgl", "Nitrato elevado",
         "Avaliar escoamento de fertilizantes e efluentes; risco para abastecimento.",
         lambda v, t: v > 10.0, lambda v, t: v > 20.0, lambda t: "máximo de 10 mg/L"),
    Rule("turbidez", "turbidity_ntu", "Turbidez elevada",
         "Indica erosão, escoamento ou descarga de sólidos; vistoriar margens e obras próximas.",
         lambda v, t: v > 100, lambda v, t: v > 300, lambda t: "máximo de 100 NTU"),
    Rule("ph", "ph", "pH fora da faixa",
         "Possível descarga química ou floração intensa; coletar amostras para análise laboratorial.",
         lambda v, t: (v < _ph_range(t)[0]) | (v > _ph_range(t)[1]),
         lambda v, t: (v < _ph_range(t)[0] - 1) | (v > _ph_range(t)[1] + 1),
         lambda t: "faixa de {:.1f} a {:.1f}".format(*_ph_range(t)).replace(".", ",")),
]

SEVERITY_ORDER = {"critico": 0, "alto": 1, "atencao": 2, "cronico": 3}


def _runs(mask: pd.Series, max_gap: int = 2) -> list[tuple[int, int]]:
    """Intervalos [i, j] (índices posicionais) onde a máscara é verdadeira,
    unindo trechos separados por até `max_gap` dias."""
    idx = [i for i, m in enumerate(mask.to_numpy()) if m]
    runs: list[list[int]] = []
    for i in idx:
        if runs and i - runs[-1][1] <= max_gap + 1:
            runs[-1][1] = i
        else:
            runs.append([i, i])
    return [(a, b) for a, b in runs]


def _fmt(v: float, param: str) -> str:
    if param == "coliforms_nmp":
        return f"{v:,.0f}".replace(",", ".")
    return f"{v:.2f}".replace(".", ",")


def threshold_alerts(df: pd.DataFrame, stations: dict[str, dict]) -> list[dict]:
    alerts = []
    for sid, g in df.groupby("station_id", sort=True):
        g = g.sort_values("date").reset_index(drop=True)
        st = stations[sid]
        for rule in RULES:
            v = g[rule.param]
            limit = rule.limit(v, st["type"]).fillna(False)
            acute = rule.acute(v, st["type"]).fillna(False)
            frac = float(limit.mean())
            chronic = frac >= CHRONIC_FRACTION
            if chronic:
                alerts.append({
                    "station_id": sid, "category": rule.category, "severity": "cronico",
                    "parameter": rule.param, "title": f"{rule.title} (situação recorrente)",
                    "start": g["date"].iloc[0], "end": g["date"].iloc[-1], "days": int(limit.sum()),
                    "peak": float(v.max()) if rule.param != "do_mgl" else float(v.min()),
                    "message": (f"{label(rule.param)} fora do limite CONAMA ({rule.limit_text(st['type'])}) "
                                f"em {frac:.0%} dos dias monitorados em {st['name']}."),
                    "recommendation": rule.recommendation,
                })
            for severity, mask, min_days in (("critico", acute, 1), ("alto", limit & (not chronic), 3)):
                for a, b in _runs(mask):
                    if b - a + 1 < min_days:
                        continue
                    if severity == "alto" and acute.iloc[a:b + 1].any():
                        continue  # já reportado como crítico
                    seg = v.iloc[a:b + 1]
                    peak = float(seg.min() if rule.param == "do_mgl" else seg.max())
                    if rule.param == "ph":
                        mid = sum(_ph_range(st["type"])) / 2
                        peak = float(seg.iloc[(seg - mid).abs().argmax()])
                    alerts.append({
                        "station_id": sid, "category": rule.category, "severity": severity,
                        "parameter": rule.param, "title": rule.title,
                        "start": g["date"].iloc[a], "end": g["date"].iloc[b], "days": b - a + 1,
                        "peak": peak,
                        "message": (f"{label(rule.param)} atingiu {_fmt(peak, rule.param)} {unit(rule.param)} "
                                    f"em {st['name']} ({rule.limit_text(st['type'])}) por {b - a + 1} dia(s)."),
                        "recommendation": rule.recommendation,
                    })
        bad = g["iqa_class"].isin(["Ruim", "Péssima"])
        for a, b in _runs(bad, max_gap=1):
            if b - a + 1 < 2:
                continue
            alerts.append({
                "station_id": sid, "category": "iqa", "severity": "alto", "parameter": "iqa",
                "title": "Qualidade da água ruim",
                "start": g["date"].iloc[a], "end": g["date"].iloc[b], "days": b - a + 1,
                "peak": float(g["iqa"].iloc[a:b + 1].min()),
                "message": (f"IQA caiu para {g['iqa'].iloc[a:b + 1].min():.0f} (classe "
                            f"{g['iqa_class'].iloc[a:b + 1].mode().iloc[0]}) em {st['name']}."),
                "recommendation": "Intensificar a amostragem e comunicar os usuários da água.",
            })
    return alerts


def anomaly_alerts(episodes: list[dict], stations: dict[str, dict]) -> list[dict]:
    alerts = []
    for ep in episodes:
        if ep["days"] < 2:
            continue
        st = stations[ep["station_id"]]
        params = ", ".join(label(p).lower() for p in ep["params"]) or "múltiplos parâmetros"
        alerts.append({
            "station_id": ep["station_id"], "category": "anomalia",
            "severity": "alto" if ep["days"] >= 3 else "atencao", "parameter": None,
            "title": "Comportamento anômalo detectado pela IA",
            "start": ep["start"], "end": ep["end"], "days": ep["days"], "peak": ep["max_score"],
            "message": (f"O modelo Isolation Forest identificou {ep['days']} dia(s) de comportamento "
                        f"atípico em {st['name']}, principalmente em: {params}."),
            "recommendation": "Conferir sensores e realizar coleta de campo para confirmar a alteração.",
            "params": ep["params"],
        })
    return alerts


def trend_alerts(trends: list[dict], stations: dict[str, dict], end_date: str) -> list[dict]:
    alerts = []
    for t in trends:
        if t["verdict"] != "piora":
            continue
        st = stations[t["station_id"]]
        alerts.append({
            "station_id": t["station_id"], "category": "tendencia", "severity": "atencao",
            "parameter": t["parameter"], "title": f"Tendência de piora: {t['label']}",
            "start": t["monthly"][0]["month"] + "-01", "end": end_date, "days": None,
            "peak": t["slope_per_year"],
            "message": (f"{t['label']} apresenta {t['direction']} de {abs(t['pct_per_year']):.0f}% ao ano "
                        f"em {st['name']} (Mann-Kendall, p = {t['p_value']:.3f})."),
            "recommendation": "Investigar mudanças no uso do solo e nas fontes de poluição da bacia.",
        })
    return alerts


def build(df, stations, episodes, trends) -> list[dict]:
    end_date = str(df["date"].max())
    alerts = (threshold_alerts(df, stations) + anomaly_alerts(episodes, stations)
              + trend_alerts(trends, stations, end_date))
    # Episódios pontuais primeiro (mais recentes e mais graves no topo); depois
    # as condições de longo prazo (tendências e situações recorrentes).
    long_term = lambda a: a["category"] == "tendencia" or a["severity"] == "cronico"
    alerts.sort(key=lambda a: (not long_term(a), str(a["end"]), -SEVERITY_ORDER[a["severity"]]), reverse=True)
    for i, a in enumerate(alerts):
        a["id"] = i + 1
        a["station_name"] = stations[a["station_id"]]["name"]
        a["start"], a["end"] = str(a["start"]), str(a["end"])
    return alerts
