"""Gera um conjunto sintético e realista de dados de qualidade da água.

Seis estações (rios, lagoa, reservatório, estuário) com leituras horárias por
dois anos, incluindo sazonalidade, ciclo diário, chuvas, falhas de sensor e
eventos ambientais rotulados (efluente, floração de algas, hipóxia...). Os
rótulos ficam em `events.csv` e servem para avaliar a detecção de anomalias.

Uso: python generate_data.py --out ../data/raw [--seed 42]
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

START = "2024-10-01"
END = "2026-09-30 23:00"
PARAMS = ["ph", "do_mgl", "temp_c", "turbidity_ntu", "conductivity_uscm",
          "nitrate_mgl", "phosphorus_mgl", "coliforms_nmp"]


@dataclass
class Station:
    id: str
    name: str
    type: str
    lat: float
    lon: float
    temp_mean: float
    temp_amp: float
    do_sat_frac: float
    ph: float
    turbidity: float
    conductivity: float
    nitrate: float
    phosphorus: float
    coliforms: float
    # Fatores multiplicativos ao final dos 2 anos (tendência linear gradual).
    trend: dict[str, float] = field(default_factory=dict)
    diurnal_do: float = 0.4


STATIONS = [
    Station("RIO-01", "Rio Claro — Nascente", "rio", -22.71, -47.12, 19, 3.5, 0.95,
            7.2, 3, 60, 0.3, 0.01, 20),
    Station("RIO-02", "Rio Claro — Jusante urbana", "rio", -22.80, -47.05, 22, 3.5, 0.68,
            6.9, 15, 350, 3.5, 0.25, 3000),
    Station("LAG-01", "Lagoa Azul", "lago", -22.95, -46.90, 23, 4.5, 0.92,
            7.6, 8, 120, 0.6, 0.04, 150, trend={"temp_c": 1.04}, diurnal_do=1.2),
    Station("RES-01", "Reservatório Serra Verde", "reservatorio", -23.05, -46.70, 23, 4.0, 0.88,
            7.3, 6, 150, 1.2, 0.05, 80,
            trend={"nitrate_mgl": 2.6, "phosphorus_mgl": 2.8, "do_sat_frac": 0.88}),
    Station("EST-01", "Estuário Baía Norte", "estuario", -23.40, -45.20, 24, 3.0, 0.85,
            7.8, 12, 22000, 0.8, 0.08, 500),
    Station("RIO-03", "Ribeirão das Pedras", "rio", -22.60, -47.40, 21, 3.5, 0.85,
            7.0, 20, 180, 4.0, 0.15, 600, trend={"turbidity_ntu": 1.5}),
]


@dataclass
class Event:
    station_id: str
    start: str
    days: int
    type: str
    description: str
    # Efeitos no pico: "+x" soma, "*x" multiplica.
    effects: dict[str, str]


EVENTS = [
    Event("RIO-02", "2025-03-10", 5, "efluente",
          "Descarga de esgoto não tratado",
          {"coliforms_nmp": "*30", "do_mgl": "+-3.0", "phosphorus_mgl": "+0.6",
           "nitrate_mgl": "+5", "turbidity_ntu": "*3", "conductivity_uscm": "+250"}),
    Event("LAG-01", "2025-01-15", 18, "floracao",
          "Floração de cianobactérias",
          {"phosphorus_mgl": "+0.15", "ph": "+1.3", "turbidity_ntu": "+18", "do_mgl": "+2.5"}),
    Event("RES-01", "2026-02-01", 12, "hipoxia",
          "Estratificação térmica e hipóxia",
          {"do_mgl": "+-4.8", "phosphorus_mgl": "+0.12", "conductivity_uscm": "+60", "ph": "+-0.5"}),
    Event("EST-01", "2025-08-05", 4, "industrial",
          "Descarga industrial ácida",
          {"ph": "+-1.6", "conductivity_uscm": "+9000", "turbidity_ntu": "*4", "temp_c": "+3"}),
    Event("RIO-03", "2025-11-20", 6, "escoamento",
          "Escoamento agrícola após chuva intensa",
          {"nitrate_mgl": "+12", "phosphorus_mgl": "+0.8", "turbidity_ntu": "*8", "coliforms_nmp": "*10"}),
    Event("RIO-02", "2026-07-12", 3, "efluente",
          "Rompimento de coletor de esgoto",
          {"coliforms_nmp": "*40", "do_mgl": "+-3.5", "phosphorus_mgl": "+0.8", "turbidity_ntu": "*2.5"}),
    Event("RIO-01", "2026-05-20", 3, "contaminacao",
          "Lançamento clandestino de efluente",
          {"coliforms_nmp": "*80", "turbidity_ntu": "*6", "do_mgl": "+-2.0", "nitrate_mgl": "+3"}),
]


def do_saturation(temp: np.ndarray) -> np.ndarray:
    return 14.652 - 0.41022 * temp + 0.007991 * temp**2 - 0.000077774 * temp**3


def event_envelope(t: pd.DatetimeIndex, start: str, days: int) -> np.ndarray:
    """Intensidade 0..1: rampa de ~1 dia na subida/descida e platô no meio."""
    s = pd.Timestamp(start)
    hours = (t - s) / pd.Timedelta(hours=1)
    total = days * 24.0
    ramp = 18.0
    up = np.clip(hours / ramp, 0, 1)
    down = np.clip((total - hours) / ramp, 0, 1)
    return np.where((hours >= 0) & (hours <= total), np.minimum(up, down), 0.0)


def rain_pulses(t: pd.DatetimeIndex, rng: np.random.Generator) -> np.ndarray:
    """Pulsos de chuva (mais frequentes de outubro a março) que decaem em ~2 dias."""
    n = len(t)
    wet = np.isin(t.month, [10, 11, 12, 1, 2, 3])
    p = np.where(wet, 1 / 300, 1 / 1500)
    impulses = (rng.random(n) < p) * rng.uniform(0.5, 2.0, n)
    kernel = np.exp(-np.arange(96) / 30.0)
    return np.convolve(impulses, kernel)[:n]


def simulate_station(st: Station, t: pd.DatetimeIndex, rng: np.random.Generator) -> pd.DataFrame:
    n = len(t)
    doy = t.dayofyear.to_numpy()
    hour = t.hour.to_numpy()
    progress = np.linspace(0, 1, n)  # 0 no início, 1 no fim dos dois anos

    def trend(name: str) -> np.ndarray:
        return 1 + (st.trend.get(name, 1.0) - 1) * progress

    def red_noise(scale: float, phi: float = 0.97) -> np.ndarray:
        e = rng.normal(0, scale * np.sqrt(1 - phi**2), n)
        out = np.empty(n)
        out[0] = e[0]
        for i in range(1, n):
            out[i] = phi * out[i - 1] + e[i]
        return out

    season = np.cos(2 * np.pi * (doy - 15) / 365.25)          # pico no verão (jan)
    diurnal = np.sin(2 * np.pi * (hour - 9) / 24)               # pico ~15h
    rain = rain_pulses(t, rng)

    temp = (st.temp_mean + st.temp_amp * season + 0.8 * diurnal + red_noise(0.6)) * trend("temp_c")
    do = (do_saturation(temp) * st.do_sat_frac * trend("do_sat_frac")
          + st.diurnal_do * diurnal + red_noise(0.25) - 0.4 * rain)
    ph = st.ph + 0.08 * diurnal * st.diurnal_do + red_noise(0.08) - 0.1 * rain
    turb = st.turbidity * trend("turbidity_ntu") * np.exp(red_noise(0.25) + 1.2 * rain)
    cond = st.conductivity * (1 + red_noise(0.04) - 0.15 * np.tanh(rain))
    nitrate = st.nitrate * trend("nitrate_mgl") * np.exp(red_noise(0.15) + 0.4 * rain)
    phos = st.phosphorus * trend("phosphorus_mgl") * np.exp(red_noise(0.2) + 0.6 * rain)
    coli = st.coliforms * np.exp(red_noise(0.5) + 1.0 * rain)

    df = pd.DataFrame({
        "ph": ph, "do_mgl": do, "temp_c": temp, "turbidity_ntu": turb,
        "conductivity_uscm": cond, "nitrate_mgl": nitrate, "phosphorus_mgl": phos,
        "coliforms_nmp": coli,
    }, index=t)

    for ev in (e for e in EVENTS if e.station_id == st.id):
        env = event_envelope(t, ev.start, ev.days)
        for col, eff in ev.effects.items():
            op, val = eff[0], float(eff[1:])
            if op == "*":
                df[col] = df[col] * (1 + (val - 1) * env)
            else:
                df[col] = df[col] + val * env

    df["do_mgl"] = df["do_mgl"].clip(lower=0.1)
    for col in ["turbidity_ntu", "nitrate_mgl", "phosphorus_mgl", "coliforms_nmp"]:
        df[col] = df[col].clip(lower=0.001)
    return inject_sensor_faults(df, rng)


def inject_sensor_faults(df: pd.DataFrame, rng: np.random.Generator) -> pd.DataFrame:
    """Valores ausentes, quedas de energia e leituras impossíveis."""
    n = len(df)
    values = df.to_numpy(copy=True)
    values[rng.random(values.shape) < 0.015] = np.nan
    for _ in range(4):
        start = rng.integers(0, n - 100)
        values[start:start + rng.integers(6, 96)] = np.nan
    impossible = {"ph": -1.0, "do_mgl": -5.0, "temp_c": 150.0, "turbidity_ntu": 99999.0}
    for col, bad in impossible.items():
        j = df.columns.get_loc(col)
        idx = rng.choice(n, size=int(n * 0.001), replace=False)
        values[idx, j] = bad
    return pd.DataFrame(values, index=df.index, columns=df.columns)


def generate(out: Path, seed: int = 42) -> None:
    rng = np.random.default_rng(seed)
    t = pd.date_range(START, END, freq="h")
    frames = []
    for st in STATIONS:
        df = simulate_station(st, t, rng)
        df.insert(0, "station_id", st.id)
        frames.append(df)
    raw = pd.concat(frames).rename_axis("timestamp").reset_index()
    raw["timestamp"] = raw["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%S")

    out.mkdir(parents=True, exist_ok=True)
    raw.to_csv(out / "measurements.csv", index=False, float_format="%.4f")
    pd.DataFrame([{"id": s.id, "name": s.name, "type": s.type, "lat": s.lat, "lon": s.lon}
                  for s in STATIONS]).to_csv(out / "stations.csv", index=False)
    pd.DataFrame([{
        "station_id": e.station_id, "start": e.start,
        "end": (pd.Timestamp(e.start) + pd.Timedelta(days=e.days - 1)).strftime("%Y-%m-%d"),
        "type": e.type, "description": e.description,
    } for e in EVENTS]).to_csv(out / "events.csv", index=False)
    print(f"generate_data: {len(raw)} leituras, {len(STATIONS)} estações, "
          f"{len(EVENTS)} eventos rotulados → {out}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", type=Path, default=Path(__file__).resolve().parent.parent / "data/raw")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    generate(args.out, args.seed)
