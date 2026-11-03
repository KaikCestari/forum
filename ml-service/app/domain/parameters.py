from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Parameter:
    key: str            # chave no JSON, ex.: "doMgl"
    label: str          # nome para a tela, ex.: "Oxigênio dissolvido"
    unit: str           # unidade, ex.: "mg/L"
    min: float          # menor valor fisicamente possível
    max: float          # maior valor fisicamente possível
    log_scale: bool     # analisar em log10 (distribuição muito assimétrica)
    worse_when: int     # +1: subir piora; -1: descer piora; 0: afastar do neutro piora


PARAMETERS: list[Parameter] = [
    Parameter("ph", "pH", "", 0.0, 14.0, False, 0),
    Parameter("doMgl", "Oxigênio dissolvido", "mg/L", 0.0, 25.0, False, -1),
    Parameter("tempC", "Temperatura", "°C", -2.0, 45.0, False, +1),
    Parameter("turbidityNtu", "Turbidez", "NTU", 0.0, 4000.0, True, +1),
    Parameter("conductivityUscm", "Condutividade", "µS/cm", 0.0, 100_000.0, True, +1),
    Parameter("nitrateMgl", "Nitrato", "mg/L", 0.0, 500.0, True, +1),
    Parameter("phosphorusMgl", "Fósforo total", "mg/L", 0.0, 50.0, True, +1),
    Parameter("coliformsNmp", "Coliformes", "NMP/100mL", 0.0, 1.0e8, True, +1),
]

PARAM_KEYS: list[str] = [p.key for p in PARAMETERS]
BY_KEY: dict[str, Parameter] = {p.key: p for p in PARAMETERS}

# pH considerado neutro: para o pH, piorar é se afastar deste valor.
NEUTRAL_PH = 7.0


def label(key: str) -> str:
    return BY_KEY[key].label if key in BY_KEY else key


def unit(key: str) -> str:
    return BY_KEY[key].unit if key in BY_KEY else ""


def describe_all() -> dict[str, dict[str, str]]:
    """Mapa {chave: {label, unit}} usado no campo `parameters` da resposta."""
    return {p.key: {"label": p.label, "unit": p.unit} for p in PARAMETERS}
