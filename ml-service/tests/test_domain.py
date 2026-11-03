import numpy as np
import pandas as pd
import pytest

from app.domain import alerts, iqa
from app.domain.cleaning import (InsufficientDataError, build_daily_table,
                                 interpolate_short_gaps, rolling_zscore, validate_ranges)
from app.domain.parameters import PARAM_KEYS


def test_clean_water_scores_high():
    value = iqa.compute(do_sat_pct=98, coliforms=10, ph=7.2, temp_dev=0.5,
                        nitrogen=0.3, phosphorus=0.02, turbidity=3)
    assert value > 80
    assert iqa.classify(value) == "Ótima"


def test_polluted_water_scores_low():
    value = iqa.compute(do_sat_pct=25, coliforms=200_000, ph=6.0, temp_dev=3,
                        nitrogen=12, phosphorus=1.5, turbidity=120)
    assert value < 37


def test_iqa_requires_five_parameters():
    assert iqa.compute(ph=7.0, turbidity=5.0) is None
    assert iqa.compute(ph=7, turbidity=5, nitrogen=1, phosphorus=0.05) is None
    assert iqa.compute(ph=7, turbidity=5, nitrogen=1, phosphorus=0.05, coliforms=100) is not None


def test_iqa_known_value_all_perfect():
    # Todas as notas q no topo da curva: OD 100% (q=100), coliformes ≤1 (100), pH 7,5 (92),
    # desvio térmico 0 (93), nitrato 0 (100), fósforo 0 (100), turbidez 0 (100).
    expected = np.exp((0.17 * np.log(100) + 0.15 * np.log(100) + 0.12 * np.log(92)
                       + 0.10 * np.log(93) + 0.10 * np.log(100) + 0.10 * np.log(100)
                       + 0.08 * np.log(100)) / 0.82)
    value = iqa.compute(do_sat_pct=100, coliforms=1, ph=7.5, temp_dev=0,
                        nitrogen=0, phosphorus=0, turbidity=0)
    assert value == pytest.approx(expected)


def test_curves_match_rust_tables():
    assert iqa.q_do_sat(100) == 100
    assert iqa.q_do_sat(50) == pytest.approx(43)          # entre (40,30) e (60,56)
    assert iqa.q_do_sat(500) == 40                         # satura na ponta
    assert iqa.q_ph(7.0) == 90
    assert iqa.q_coliforms(1000) == pytest.approx(30)      # log10 = 3
    assert iqa.q_coliforms(0.1) == 100                     # piso em 1 NMP
    assert iqa.q_temp_dev(-5) == 72                        # usa o valor absoluto
    assert iqa.q_turbidity(25) == 60
    assert iqa.q_phosphorus(0.1) == 90
    assert iqa.q_nitrogen(10) == 52


def test_do_saturation_at_20c():
    assert iqa.do_saturation(20.0) == pytest.approx(9.09, abs=0.1)


@pytest.mark.parametrize("value,expected", [
    (95, "Ótima"), (80, "Ótima"), (79.9, "Boa"), (52, "Boa"), (51.9, "Regular"),
    (37, "Regular"), (36.9, "Ruim"), (20, "Ruim"), (19.9, "Péssima"), (0, "Péssima"),
    (None, None), (float("nan"), None),
])
def test_iqa_classes(value, expected):
    assert iqa.classify(value) == expected


def _hourly(station, start, hours, **values):
    ts = pd.date_range(start, periods=hours, freq="h")
    df = pd.DataFrame({"timestamp": ts.strftime("%Y-%m-%dT%H:%M:%S"), "stationId": station})
    for key in PARAM_KEYS:
        df[key] = values.get(key, np.nan)
    return df


def test_validate_ranges_drops_impossible_values():
    df = pd.DataFrame({k: [np.nan] for k in PARAM_KEYS})
    df["ph"], df["doMgl"], df["tempC"] = [-1.0], [7.0], [150.0]
    out = validate_ranges(df)
    assert np.isnan(out["ph"].iloc[0]) and np.isnan(out["tempC"].iloc[0])
    assert out["doMgl"].iloc[0] == 7.0


def test_interpolates_short_gaps_only():
    s = pd.Series([1.0, np.nan, np.nan, 4.0, np.nan, np.nan, np.nan, np.nan, 0.0, np.nan])
    out = interpolate_short_gaps(s, 3)
    assert out.iloc[1] == pytest.approx(2.0) and out.iloc[2] == pytest.approx(3.0)
    assert out.iloc[4:8].isna().all()      # buraco de 4 > 3: não preenche nada
    assert np.isnan(out.iloc[9])           # ponta da série fica vazia


def test_zscore_flags_jump():
    s = pd.Series([10.0 + (i % 3) * 0.1 for i in range(30)] + [20.0])
    z = rolling_zscore(s, 30, 10)
    assert np.isnan(z.iloc[5])
    assert z.iloc[30] > 10


def test_day_needs_six_readings():
    ok = _hourly("A", "2026-01-01 00:00", 6, ph=7.0, doMgl=8.0)       # 6 leituras
    few = _hourly("A", "2026-01-03 00:00", 5, ph=7.0, doMgl=8.0)      # 5 leituras
    daily, report = build_daily_table(pd.concat([ok, few], ignore_index=True))
    assert daily["date"].tolist() == ["2026-01-01"]
    assert report.days == 1 and report.discarded_days == 1
    assert report.raw_readings == 11 and report.valid_readings == 11


def test_no_day_with_six_readings_raises():
    with pytest.raises(InsufficientDataError, match="6 leituras"):
        build_daily_table(_hourly("A", "2026-01-01", 5, ph=7.0))


def test_invalid_values_do_not_count_as_readings():
    df = _hourly("A", "2026-01-01", 8, ph=7.0)
    df.loc[:2, "ph"] = -5.0  # 3 leituras impossíveis → sobram 5
    with pytest.raises(InsufficientDataError):
        build_daily_table(df)


def test_daily_mean_and_short_hourly_gap_filled():
    df = _hourly("A", "2026-01-01", 24, ph=7.0, tempC=20.0)
    df.loc[5:8, "tempC"] = np.nan         # 4 horas sem temperatura: interpoladas
    df.loc[10, "tempC"] = 26.0
    daily, _ = build_daily_table(df)
    assert daily["ph"].iloc[0] == pytest.approx(7.0)
    assert daily["tempC"].iloc[0] == pytest.approx(20.25)
    assert np.isnan(daily["doMgl"].iloc[0])


def test_alerts_group_consecutive_days_and_severity():
    days = pd.DataFrame({
        "stationId": "A",
        "date": ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-10"],
        **{k: [np.nan] * 4 for k in PARAM_KEYS},
    })
    days["doMgl"] = [4.0, 2.5, 4.5, 4.8]
    result = alerts.station_alerts(days, "rio")
    assert len(result) == 2
    first, second = result
    assert first["date"] == "2026-01-03" and first["severity"] == "critico"
    assert first["value"] == 2.5 and first["unit"] == "mg/L"
    assert "5 mg/L" in first["message"]
    assert second["severity"] == "atencao"


def test_phosphorus_limit_depends_on_station_type():
    assert alerts.phosphorus_limit("lago") == 0.03
    assert alerts.phosphorus_limit("rio") == 0.1
    assert alerts.ph_range("estuario") == (6.5, 8.5)
