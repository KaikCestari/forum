"""Testes ponta a ponta da etapa de ML (gera dados → Rust → análise)."""

import json
import shutil
import subprocess
from pathlib import Path

import pandas as pd
import pytest

import analyze
import generate_data
from aquaml import alerts, trends

ROOT = Path(__file__).resolve().parents[2]
PROCESSOR = ROOT / "processor/target/release/aqua-processor"


@pytest.fixture(scope="module")
def pipeline(tmp_path_factory):
    if not PROCESSOR.exists():
        pytest.skip("binário Rust não compilado (rode `make build`)")
    tmp = tmp_path_factory.mktemp("aquaml")
    raw, processed, out = tmp / "raw", tmp / "processed", tmp / "results.json"
    generate_data.generate(raw, seed=7)
    subprocess.run([PROCESSOR, "--input", raw / "measurements.csv", "--out", processed], check=True)
    result = analyze.run(processed, raw, out)
    yield raw, processed, out, result
    shutil.rmtree(tmp, ignore_errors=True)


def test_generator_outputs(pipeline):
    raw, *_ = pipeline
    m = pd.read_csv(raw / "measurements.csv")
    assert set(m["station_id"]) == {s.id for s in generate_data.STATIONS}
    assert m[generate_data.PARAMS].isna().mean().mean() > 0.01  # falhas de sensor presentes
    assert len(pd.read_csv(raw / "events.csv")) == len(generate_data.EVENTS)


def test_detects_most_injected_events(pipeline):
    *_, result = pipeline
    ev = result["anomalies"]["evaluation"]
    assert ev["event_recall"] >= 0.85
    assert ev["day_precision"] > 0.15


def test_classifier_generalizes(pipeline):
    *_, result = pipeline
    clf = result["classification"]
    assert clf["accuracy"] > 0.8
    assert clf["accuracy_one_sensor_missing"] > 0.75


def test_planted_trends_found(pipeline):
    *_, result = pipeline
    found = {(t["station_id"], t["parameter"]) for t in result["trends"] if t["verdict"] == "piora"}
    assert ("RES-01", "phosphorus_mgl") in found
    assert ("RES-01", "nitrate_mgl") in found
    assert ("RIO-01", "phosphorus_mgl") not in found


def test_results_json_schema(pipeline):
    *_, out, _ = pipeline
    data = json.loads(out.read_text())
    for key in ["stations", "alerts", "anomalies", "classification", "clusters", "trends", "series",
                "insights", "processing"]:
        assert key in data
    s = data["series"]["RIO-01"]
    assert len(s["dates"]) == len(s["iqa"]) == len(s["anomaly"])
    assert all(a["severity"] in alerts.SEVERITY_ORDER for a in data["alerts"])


def test_alert_runs_merge_small_gaps():
    mask = pd.Series([True, True, False, False, True, False, False, False, False, True])
    assert alerts._runs(mask, max_gap=2) == [(0, 4), (9, 9)]


def test_trend_detects_linear_increase():
    dates = pd.date_range("2024-01-01", "2025-12-31", freq="D")
    df = pd.DataFrame({"station_id": "X", "date": dates.strftime("%Y-%m-%d")})
    for p in ["ph", "do_mgl", "temp_c", "turbidity_ntu", "conductivity_uscm", "nitrate_mgl",
              "phosphorus_mgl", "coliforms_nmp", "iqa"]:
        df[p] = 10.0
    df["nitrate_mgl"] = 1 + pd.Series(range(len(dates))) / 365
    t = {r["parameter"]: r for r in trends.analyze(df)}
    assert t["nitrate_mgl"]["verdict"] == "piora"
    assert abs(t["nitrate_mgl"]["slope_per_year"] - 1.0) < 0.05
