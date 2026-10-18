//! Validação de faixas, interpolação de lacunas e agregação diária.

use std::collections::BTreeMap;

use chrono::{Duration, NaiveDate};

use crate::model::{Reading, Values, N_PARAMS, PARAMS};

/// Descarta valores fora da faixa física do parâmetro (falhas de sensor).
/// Retorna quantos valores foram invalidados por parâmetro.
pub fn validate(values: &mut Values) -> [usize; N_PARAMS] {
    let mut invalid = [0; N_PARAMS];
    for (i, v) in values.iter_mut().enumerate() {
        if let Some(x) = *v {
            if !x.is_finite() || x < PARAMS[i].min || x > PARAMS[i].max {
                *v = None;
                invalid[i] += 1;
            }
        }
    }
    invalid
}

/// Preenche por interpolação linear lacunas internas de até `max_gap` posições.
/// Lacunas maiores ou nas bordas da série permanecem vazias. Retorna o número
/// de valores preenchidos.
pub fn interpolate_gaps(series: &mut [Option<f64>], max_gap: usize) -> usize {
    let mut filled = 0;
    let mut last: Option<usize> = None;
    for i in 0..series.len() {
        if series[i].is_none() {
            continue;
        }
        if let Some(j) = last {
            let gap = i - j - 1;
            if gap > 0 && gap <= max_gap {
                let (a, b) = (series[j].unwrap(), series[i].unwrap());
                for k in 1..=gap {
                    let t = k as f64 / (gap + 1) as f64;
                    series[j + k] = Some(a + (b - a) * t);
                }
                filled += gap;
            }
        }
        last = Some(i);
    }
    filled
}

/// Coloca as leituras numa grade horária regular (horas sem leitura viram `None`).
/// Leituras duplicadas na mesma hora são substituídas pela última.
pub fn hourly_grid(readings: &[Reading]) -> (chrono::NaiveDateTime, Vec<Values>) {
    let start = readings.iter().map(|r| r.time).min().expect("série vazia");
    let end = readings.iter().map(|r| r.time).max().unwrap();
    let hours = (end - start).num_hours() as usize + 1;
    let mut grid = vec![[None; N_PARAMS]; hours];
    for r in readings {
        let idx = (r.time - start).num_hours() as usize;
        grid[idx] = r.values;
    }
    (start, grid)
}

/// Média diária de cada parâmetro. Um dia só recebe valor para um parâmetro
/// se tiver ao menos `min_hours` leituras daquele parâmetro.
pub fn daily_means(
    start: chrono::NaiveDateTime,
    grid: &[Values],
    min_hours: usize,
) -> BTreeMap<NaiveDate, (Values, f64)> {
    let mut acc: BTreeMap<NaiveDate, ([f64; N_PARAMS], [usize; N_PARAMS], usize, usize)> =
        BTreeMap::new();
    for (h, values) in grid.iter().enumerate() {
        let date = (start + Duration::hours(h as i64)).date();
        let e = acc.entry(date).or_insert(([0.0; N_PARAMS], [0; N_PARAMS], 0, 0));
        e.3 += 1;
        if values.iter().any(Option::is_some) {
            e.2 += 1;
        }
        for (i, v) in values.iter().enumerate() {
            if let Some(x) = v {
                e.0[i] += x;
                e.1[i] += 1;
            }
        }
    }
    acc.into_iter()
        .map(|(date, (sum, n, hours_ok, hours_total))| {
            let mut means = [None; N_PARAMS];
            for i in 0..N_PARAMS {
                if n[i] >= min_hours {
                    means[i] = Some(sum[i] / n[i] as f64);
                }
            }
            (date, (means, hours_ok as f64 / hours_total.max(1) as f64))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_drops_out_of_range() {
        let mut v: Values = [Some(7.0), Some(-3.0), Some(20.0), None, Some(1e9), None, None, None];
        let inv = validate(&mut v);
        assert_eq!(v[0], Some(7.0));
        assert_eq!(v[1], None);
        assert_eq!(v[4], None);
        assert_eq!(inv.iter().sum::<usize>(), 2);
    }

    #[test]
    fn interpolates_short_gaps_only() {
        let mut s = vec![Some(1.0), None, None, Some(4.0), None, None, None, None, Some(0.0), None];
        let filled = interpolate_gaps(&mut s, 3);
        assert_eq!(filled, 2);
        assert_eq!(s[1], Some(2.0));
        assert_eq!(s[2], Some(3.0));
        assert!(s[4..8].iter().all(Option::is_none));
        assert_eq!(s[9], None);
    }
}
