import json
import math

import pytest
from fastapi.testclient import TestClient

from app.domain.parameters import PARAM_KEYS
from app.main import app
from tools.generate_data import build_request

client = TestClient(app)

TOP_KEYS = {"generatedAt", "period", "parameters", "processing", "stations", "insights",
            "alerts", "anomalies", "classification", "clusters", "trends", "series"}
STATION_KEYS = {"stationId", "name", "type", "latest", "iqaPeriod", "predictedClass", "cluster",
                "clusterLabel", "worseningTrends", "alertsTotal", "alertsRecent", "criticalTotal"}
IQA_CLASSES = {"Ótima", "Boa", "Regular", "Ruim", "Péssima"}


def _post(payload: dict):
    # Serializa como o Java faria (JSON estrito, sem NaN).
    return client.post("/analyze", content=json.dumps(payload, allow_nan=False),
                       headers={"Content-Type": "application/json"})


def _no_nan(obj):
    if isinstance(obj, float):
        assert math.isfinite(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            _no_nan(v)
    elif isinstance(obj, list):
        for v in obj:
            _no_nan(v)


def _hourly_rows(station, days, **values):
    rows = []
    for d in range(days):
        for h in range(24):
            day = f"2026-01-{d + 1:02d}" if d < 31 else f"2026-02-{d - 30:02d}"
            rows.append({"timestamp": f"{day}T{h:02d}:00:00", "stationId": station, **values})
    return rows


@pytest.fixture(scope="module")
def full():
    payload = build_request(seed=7)
    response = _post(payload)
    assert response.status_code == 200, response.text
    return payload, response.json()


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_top_level_shape(full):
    _, body = full
    assert set(body) == TOP_KEYS
    assert body["generatedAt"].endswith("Z")
    assert set(body["period"]) == {"start", "end"}
    assert set(body["parameters"]) == set(PARAM_KEYS)
    assert body["parameters"]["doMgl"] == {"label": "Oxigênio dissolvido", "unit": "mg/L"}
    assert set(body["processing"]) == {"rawReadings", "validReadings", "days", "discardedDays"}
    assert body["processing"]["rawReadings"] == 6 * 730 * 24
    assert body["insights"] and all(isinstance(s, str) for s in body["insights"])
    _no_nan(body)


def test_stations_shape(full):
    payload, body = full
    assert {s["stationId"] for s in body["stations"]} == {s["id"] for s in payload["stations"]}
    for s in body["stations"]:
        assert set(s) == STATION_KEYS
        assert set(s["latest"]) == {"date", "iqa", "iqaClass"}
        assert s["latest"]["iqaClass"] in IQA_CLASSES
        assert s["predictedClass"] in IQA_CLASSES
        assert set(s["worseningTrends"]) <= set(PARAM_KEYS)


def test_alerts_shape(full):
    _, body = full
    assert body["alerts"]
    for a in body["alerts"]:
        assert set(a) == {"stationId", "date", "parameter", "value", "unit", "severity", "message"}
        assert a["severity"] in {"atencao", "critico"}
        assert a["parameter"] in PARAM_KEYS


def test_anomalies_detect_known_events(full):
    _, body = full
    an = body["anomalies"]
    assert set(an) == {"method", "episodes", "evaluation"}
    assert set(an["evaluation"]) == {"knownEvents", "detected", "recall"}
    assert an["evaluation"]["knownEvents"] == 7
    assert an["evaluation"]["recall"] >= 0.85
    ep = an["episodes"][0]
    assert set(ep) == {"stationId", "start", "end", "days", "maxScore", "parameters"}


def test_classification_and_clusters(full):
    _, body = full
    clf = body["classification"]
    assert set(clf) == {"method", "accuracy", "featureImportance", "current"}
    assert clf["method"] == "Random Forest" and clf["accuracy"] > 0.8
    assert set(clf["featureImportance"][0]) == {"feature", "importance"}
    clus = body["clusters"]
    assert set(clus) == {"method", "points", "profiles"}
    assert set(clus["points"][0]) == {"stationId", "date", "x", "y", "cluster"}
    assert set(clus["profiles"][0]) == {"cluster", "label", "size", "means"}


def test_trends_find_planted_trends(full):
    _, body = full
    assert set(body["trends"][0]) == {"stationId", "parameter", "direction", "slopePerYear", "pValue"}
    worse = {(t["stationId"], t["parameter"]) for t in body["trends"] if t["direction"] == "piora"}
    assert ("RES-01", "phosphorusMgl") in worse
    assert ("RES-01", "nitrateMgl") in worse
    assert ("RIO-01", "phosphorusMgl") not in worse
    assert {t["direction"] for t in body["trends"]} <= {"piora", "melhora", "estavel"}


def test_series_shape(full):
    _, body = full
    s = body["series"]["RIO-01"]
    assert set(s) == {"dates", "iqa", "iqaClass", "anomaly", "anomalyScore", "params"}
    n = len(s["dates"])
    assert n == len(s["iqa"]) == len(s["iqaClass"]) == len(s["anomaly"]) == len(s["anomalyScore"])
    assert set(s["params"]) == set(PARAM_KEYS)
    assert all(len(v) == n for v in s["params"].values())


def test_deterministic():
    payload = build_request(seed=3, days=120, station_ids=["RIO-02", "LAG-01"])
    a, b = _post(payload).json(), _post(payload).json()
    a.pop("generatedAt"), b.pop("generatedAt")
    assert a == b


def test_single_station_few_days_skips_ml_gracefully():
    payload = build_request(seed=1, days=10, station_ids=["RIO-01"])
    response = _post(payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == TOP_KEYS
    assert len(body["stations"]) == 1
    assert body["classification"]["accuracy"] is None
    assert body["classification"]["featureImportance"] == []
    assert body["classification"]["current"] == {}
    assert "não executado" in body["classification"]["method"]
    assert body["clusters"]["points"] == [] and body["clusters"]["profiles"] == []
    assert "não executado" in body["clusters"]["method"]
    assert body["anomalies"]["evaluation"] is None
    assert body["stations"][0]["cluster"] is None
    _no_nan(body)


def test_missing_parameters_and_no_iqa():
    # Só pH e turbidez: sem IQA possível, mas a análise não pode quebrar.
    rows = _hourly_rows("lago-x", 45, ph=7.2, turbidityNtu=15.0)
    response = _post({"stations": [{"id": "lago-x", "name": "Lago X", "type": "lago"}],
                      "measurements": rows, "events": []})
    assert response.status_code == 200, response.text
    body = response.json()
    st = body["stations"][0]
    assert st["latest"] is None and st["iqaPeriod"] is None
    assert all(v is None for v in body["series"]["lago-x"]["iqa"])
    assert all(v is None for v in body["series"]["lago-x"]["params"]["doMgl"])
    assert any("IQA" in s for s in body["insights"])
    _no_nan(body)


def test_nulls_and_unknown_station_and_events_without_end():
    rows = _hourly_rows("rio-z", 3, ph=7.0, doMgl=None, tempC=21.0, turbidityNtu=5.0,
                        coliformsNmp=50000.0, nitrateMgl=None, phosphorusMgl=0.05)
    payload = {"measurements": rows,  # estação não cadastrada em `stations`
               "events": [{"stationId": "rio-z", "start": "2026-01-02"}]}
    response = _post(payload)
    assert response.status_code == 200, response.text
    body = response.json()
    st = body["stations"][0]
    assert st["name"] == "rio-z" and st["type"] == "rio"
    assert body["anomalies"]["evaluation"] == {"knownEvents": 1, "detected": 0, "recall": 0.0}
    assert any(a["severity"] == "critico" and a["parameter"] == "coliformsNmp"
               for a in body["alerts"])


def test_not_enough_readings_returns_422_in_portuguese():
    rows = [{"timestamp": f"2026-01-0{d}T08:00:00", "stationId": "a", "ph": 7.0}
            for d in range(1, 8)]  # uma leitura por dia
    response = _post({"stations": [], "measurements": rows, "events": []})
    assert response.status_code == 422
    assert "6 leituras" in response.json()["detail"]


def test_empty_request_returns_422():
    response = _post({"stations": [], "measurements": [], "events": []})
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)


def test_malformed_request_returns_422_string_detail():
    response = _post({"measurements": [{"stationId": "a"}]})
    assert response.status_code == 422
    assert "timestamp" in response.json()["detail"]
