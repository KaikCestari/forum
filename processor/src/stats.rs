//! Estatísticas móveis sobre séries diárias.

/// Média móvel retroativa (janela inclui o dia atual). Exige ao menos
/// metade da janela com dados.
pub fn rolling_mean(series: &[Option<f64>], window: usize) -> Vec<Option<f64>> {
    (0..series.len())
        .map(|i| {
            let lo = (i + 1).saturating_sub(window);
            let vals: Vec<f64> = series[lo..=i].iter().flatten().copied().collect();
            if vals.len() * 2 >= window.min(i + 1) && !vals.is_empty() {
                Some(vals.iter().sum::<f64>() / vals.len() as f64)
            } else {
                None
            }
        })
        .collect()
}

/// Z-score de cada dia em relação aos `window` dias anteriores (sem o dia
/// atual), o que destaca mudanças bruscas frente ao comportamento recente.
pub fn rolling_zscore(series: &[Option<f64>], window: usize, min_obs: usize) -> Vec<Option<f64>> {
    (0..series.len())
        .map(|i| {
            let x = series[i]?;
            let lo = i.saturating_sub(window);
            let vals: Vec<f64> = series[lo..i].iter().flatten().copied().collect();
            if vals.len() < min_obs {
                return None;
            }
            let n = vals.len() as f64;
            let mean = vals.iter().sum::<f64>() / n;
            let var = vals.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / (n - 1.0);
            // Piso no desvio evita z-scores explosivos em séries quase constantes.
            let sd = var.sqrt().max(mean.abs() * 0.01).max(1e-6);
            Some((x - mean) / sd)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rolling_mean_basic() {
        let s = vec![Some(1.0), Some(2.0), Some(3.0), None, Some(5.0)];
        let m = rolling_mean(&s, 3);
        assert_eq!(m[0], Some(1.0));
        assert_eq!(m[2], Some(2.0));
        assert_eq!(m[3], Some(2.5));
        assert_eq!(m[4], Some(4.0));
    }

    #[test]
    fn zscore_flags_jump() {
        let mut s: Vec<Option<f64>> = (0..30).map(|i| Some(10.0 + (i % 3) as f64 * 0.1)).collect();
        s.push(Some(20.0));
        let z = rolling_zscore(&s, 30, 10);
        assert!(z[5].is_none());
        assert!(z[30].unwrap() > 10.0);
    }
}
