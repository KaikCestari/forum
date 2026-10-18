//! aqua-processor: etapa de processamento de alto desempenho do AquaML.
//!
//! Lê as leituras horárias brutas das estações, descarta valores impossíveis,
//! interpola lacunas curtas, agrega por dia, calcula estatísticas móveis e o
//! IQA, e grava `processed.csv` + `summary.json` para a etapa de ML (Python).

mod clean;
mod iqa;
mod model;
mod stats;

use std::collections::HashMap;
use std::fs::{self, File};
use std::path::PathBuf;
use std::time::Instant;

use chrono::NaiveDateTime;
use clap::Parser;
use rayon::prelude::*;
use serde::Serialize;

use model::{DailyRow, Reading, Values, N_PARAMS, PARAMS};

#[derive(Parser)]
#[command(about = "Processa dados brutos de qualidade da água")]
struct Args {
    /// CSV de leituras brutas (timestamp, station_id, parâmetros...)
    #[arg(long)]
    input: PathBuf,
    /// Diretório de saída
    #[arg(long)]
    out: PathBuf,
    /// Maior lacuna horária preenchida por interpolação
    #[arg(long, default_value_t = 6)]
    max_hourly_gap: usize,
    /// Maior lacuna diária preenchida por interpolação
    #[arg(long, default_value_t = 3)]
    max_daily_gap: usize,
}

#[derive(Serialize, Default)]
struct StationStats {
    hours: usize,
    days: usize,
    interpolated_hourly: usize,
    interpolated_daily: usize,
    days_with_iqa: usize,
}

#[derive(Serialize)]
struct Summary {
    input_file: String,
    rows_read: usize,
    stations: usize,
    values_read: usize,
    missing_values: usize,
    invalid_values: HashMap<&'static str, usize>,
    invalid_total: usize,
    interpolated_hourly: usize,
    interpolated_daily: usize,
    days_output: usize,
    days_with_iqa: usize,
    threads: usize,
    read_ms: u128,
    process_ms: u128,
    write_ms: u128,
    total_ms: u128,
    per_station: HashMap<String, StationStats>,
}

fn parse_time(s: &str) -> Option<NaiveDateTime> {
    NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S")
        .or_else(|_| NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S"))
        .or_else(|_| NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M"))
        .ok()
}

struct Loaded {
    by_station: HashMap<String, Vec<Reading>>,
    rows: usize,
    missing: usize,
    invalid: [usize; N_PARAMS],
}

fn read_input(path: &PathBuf) -> Result<Loaded, Box<dyn std::error::Error>> {
    let mut rdr = csv::Reader::from_path(path)?;
    let headers = rdr.headers()?.clone();
    let col = |name: &str| {
        headers
            .iter()
            .position(|h| h == name)
            .ok_or_else(|| format!("coluna ausente no CSV: {name}"))
    };
    let ts_idx = col("timestamp")?;
    let st_idx = col("station_id")?;
    let p_idx: Vec<usize> = PARAMS.iter().map(|p| col(p.name)).collect::<Result<_, _>>()?;

    let mut out = Loaded { by_station: HashMap::new(), rows: 0, missing: 0, invalid: [0; N_PARAMS] };
    for rec in rdr.records() {
        let rec = rec?;
        let Some(time) = parse_time(&rec[ts_idx]) else { continue };
        let mut values: Values = [None; N_PARAMS];
        for (i, &idx) in p_idx.iter().enumerate() {
            values[i] = rec[idx].trim().parse::<f64>().ok();
            if values[i].is_none() {
                out.missing += 1;
            }
        }
        let inv = clean::validate(&mut values);
        for i in 0..N_PARAMS {
            out.invalid[i] += inv[i];
        }
        out.rows += 1;
        out.by_station
            .entry(rec[st_idx].to_string())
            .or_default()
            .push(Reading { time, values });
    }
    Ok(out)
}

fn column(rows: &[Values], i: usize) -> Vec<Option<f64>> {
    rows.iter().map(|v| v[i]).collect()
}

fn process_station(
    station_id: &str,
    readings: &[Reading],
    max_hourly_gap: usize,
    max_daily_gap: usize,
) -> (Vec<DailyRow>, StationStats) {
    let mut st = StationStats::default();
    let (start, mut grid) = clean::hourly_grid(readings);
    st.hours = grid.len();

    for i in 0..N_PARAMS {
        let mut col = column(&grid, i);
        st.interpolated_hourly += clean::interpolate_gaps(&mut col, max_hourly_gap);
        for (h, v) in col.into_iter().enumerate() {
            grid[h][i] = v;
        }
    }

    let daily = clean::daily_means(start, &grid, 6);
    let dates: Vec<_> = daily.keys().copied().collect();
    let coverage: Vec<f64> = daily.values().map(|(_, c)| *c).collect();
    let mut days: Vec<Values> = daily.values().map(|(v, _)| *v).collect();
    st.days = days.len();

    let mut ma7 = vec![[None; N_PARAMS]; days.len()];
    let mut z30 = vec![[None; N_PARAMS]; days.len()];
    for i in 0..N_PARAMS {
        let mut col = column(&days, i);
        st.interpolated_daily += clean::interpolate_gaps(&mut col, max_daily_gap);
        let m = stats::rolling_mean(&col, 7);
        let z = stats::rolling_zscore(&col, 30, 10);
        for d in 0..days.len() {
            days[d][i] = col[d];
            ma7[d][i] = m[d];
            z30[d][i] = z[d];
        }
    }

    // Referência de temperatura para o termo de variação térmica do IQA.
    let temp_ref = stats::rolling_mean(&column(&days, model::TEMP), 30);

    let rows = (0..days.len())
        .map(|d| {
            let v = days[d];
            let do_sat_pct = match (v[model::DO], v[model::TEMP]) {
                (Some(o), Some(t)) => Some(o / iqa::do_saturation(t) * 100.0),
                _ => None,
            };
            let iqa = iqa::compute(&iqa::IqaInputs {
                do_sat_pct,
                coliforms: v[model::COLIFORMS],
                ph: v[model::PH],
                temp_dev: v[model::TEMP].zip(temp_ref[d]).map(|(t, r)| t - r),
                nitrogen: v[model::NITRATE],
                phosphorus: v[model::PHOSPHORUS],
                turbidity: v[model::TURB],
            });
            DailyRow {
                station_id: station_id.to_string(),
                date: dates[d],
                coverage: coverage[d],
                values: v,
                ma7: ma7[d],
                z30: z30[d],
                do_sat_pct,
                iqa,
            }
        })
        .collect::<Vec<_>>();
    st.days_with_iqa = rows.iter().filter(|r| r.iqa.is_some()).count();
    (rows, st)
}

fn fmt(v: Option<f64>) -> String {
    v.map(|x| format!("{x:.4}")).unwrap_or_default()
}

fn write_processed(path: &PathBuf, rows: &[DailyRow]) -> Result<(), Box<dyn std::error::Error>> {
    let mut w = csv::Writer::from_path(path)?;
    let mut header = vec!["station_id".to_string(), "date".into(), "coverage".into()];
    for p in &PARAMS {
        header.push(p.name.into());
        header.push(format!("{}_ma7", p.name));
        header.push(format!("{}_z30", p.name));
    }
    header.extend(["do_sat_pct".into(), "iqa".into(), "iqa_class".into()]);
    w.write_record(&header)?;

    for r in rows {
        let mut rec = vec![r.station_id.clone(), r.date.to_string(), format!("{:.3}", r.coverage)];
        for i in 0..N_PARAMS {
            rec.push(fmt(r.values[i]));
            rec.push(fmt(r.ma7[i]));
            rec.push(fmt(r.z30[i]));
        }
        rec.push(fmt(r.do_sat_pct));
        rec.push(fmt(r.iqa));
        rec.push(r.iqa.map(iqa::class).unwrap_or_default().to_string());
        w.write_record(&rec)?;
    }
    w.flush()?;
    Ok(())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();
    let t0 = Instant::now();

    let loaded = read_input(&args.input)?;
    let read_ms = t0.elapsed().as_millis();

    let t1 = Instant::now();
    let mut stations: Vec<(&String, &Vec<Reading>)> = loaded.by_station.iter().collect();
    stations.sort_by_key(|(id, _)| id.as_str());
    let results: Vec<(String, Vec<DailyRow>, StationStats)> = stations
        .par_iter()
        .map(|(id, readings)| {
            let (rows, st) = process_station(id, readings, args.max_hourly_gap, args.max_daily_gap);
            (id.to_string(), rows, st)
        })
        .collect();
    let process_ms = t1.elapsed().as_millis();

    let t2 = Instant::now();
    fs::create_dir_all(&args.out)?;
    let all_rows: Vec<DailyRow> = results.iter().flat_map(|(_, r, _)| r.iter().cloned()).collect();
    write_processed(&args.out.join("processed.csv"), &all_rows)?;
    let write_ms = t2.elapsed().as_millis();

    let per_station: HashMap<String, StationStats> =
        results.into_iter().map(|(id, _, st)| (id, st)).collect();
    let summary = Summary {
        input_file: args.input.display().to_string(),
        rows_read: loaded.rows,
        stations: per_station.len(),
        values_read: loaded.rows * N_PARAMS,
        missing_values: loaded.missing,
        invalid_values: PARAMS.iter().zip(loaded.invalid).map(|(p, n)| (p.name, n)).collect(),
        invalid_total: loaded.invalid.iter().sum(),
        interpolated_hourly: per_station.values().map(|s| s.interpolated_hourly).sum(),
        interpolated_daily: per_station.values().map(|s| s.interpolated_daily).sum(),
        days_output: all_rows.len(),
        days_with_iqa: per_station.values().map(|s| s.days_with_iqa).sum(),
        threads: rayon::current_num_threads(),
        read_ms,
        process_ms,
        write_ms,
        total_ms: t0.elapsed().as_millis(),
        per_station,
    };
    serde_json::to_writer_pretty(File::create(args.out.join("summary.json"))?, &summary)?;

    eprintln!(
        "aqua-processor: {} leituras, {} estações, {} valores inválidos, {} dias gerados em {} ms",
        summary.rows_read, summary.stations, summary.invalid_total, summary.days_output, summary.total_ms
    );
    Ok(())
}
