//! Índice de Qualidade das Águas (IQA), versão simplificada do IQA-CETESB/NSF.
//!
//! O IQA original usa nove parâmetros. Aqui DBO e sólidos totais não são
//! medidos, então usamos os sete disponíveis e renormalizamos os pesos.
//! As curvas de qualidade (q) são aproximações lineares por partes das
//! curvas da NSF.

/// Interpola linearmente em uma tabela (x crescente); satura nas bordas.
fn curve(points: &[(f64, f64)], x: f64) -> f64 {
    if x <= points[0].0 {
        return points[0].1;
    }
    for w in points.windows(2) {
        let ((x0, y0), (x1, y1)) = (w[0], w[1]);
        if x <= x1 {
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
        }
    }
    points[points.len() - 1].1
}

/// Oxigênio dissolvido de saturação (mg/L) em água doce, em função da temperatura.
pub fn do_saturation(temp_c: f64) -> f64 {
    14.652 - 0.41022 * temp_c + 0.007_991 * temp_c.powi(2) - 0.000_077_774 * temp_c.powi(3)
}

pub fn q_do_sat(pct: f64) -> f64 {
    curve(
        &[(0.0, 2.0), (20.0, 12.0), (40.0, 30.0), (60.0, 56.0), (80.0, 85.0), (100.0, 100.0),
          (120.0, 90.0), (140.0, 70.0), (160.0, 55.0), (200.0, 40.0)],
        pct,
    )
}

pub fn q_coliforms(nmp: f64) -> f64 {
    let lg = nmp.max(1.0).log10();
    curve(&[(0.0, 100.0), (1.0, 80.0), (2.0, 55.0), (3.0, 30.0), (4.0, 15.0), (5.0, 5.0), (6.0, 3.0)], lg)
}

pub fn q_ph(ph: f64) -> f64 {
    curve(
        &[(2.0, 2.0), (3.0, 4.0), (4.0, 10.0), (5.0, 25.0), (6.0, 55.0), (7.0, 90.0), (7.5, 92.0),
          (8.0, 82.0), (9.0, 55.0), (10.0, 25.0), (11.0, 10.0), (12.0, 3.0)],
        ph,
    )
}

/// `dev` = |temperatura − referência| (°C).
pub fn q_temp_dev(dev: f64) -> f64 {
    curve(&[(0.0, 93.0), (5.0, 72.0), (10.0, 45.0), (15.0, 25.0), (20.0, 10.0)], dev.abs())
}

pub fn q_nitrogen(mgl: f64) -> f64 {
    curve(&[(0.0, 100.0), (5.0, 75.0), (10.0, 52.0), (20.0, 30.0), (50.0, 10.0), (100.0, 2.0)], mgl)
}

pub fn q_phosphorus(mgl: f64) -> f64 {
    curve(&[(0.0, 100.0), (0.1, 90.0), (0.5, 60.0), (1.0, 45.0), (2.0, 30.0), (5.0, 10.0), (10.0, 2.0)], mgl)
}

pub fn q_turbidity(ntu: f64) -> f64 {
    curve(&[(0.0, 100.0), (10.0, 78.0), (25.0, 60.0), (50.0, 42.0), (100.0, 18.0), (150.0, 5.0)], ntu)
}

/// Entradas do IQA para um dia; `None` = parâmetro indisponível.
#[derive(Default)]
pub struct IqaInputs {
    pub do_sat_pct: Option<f64>,
    pub coliforms: Option<f64>,
    pub ph: Option<f64>,
    pub temp_dev: Option<f64>,
    pub nitrogen: Option<f64>,
    pub phosphorus: Option<f64>,
    pub turbidity: Option<f64>,
}

/// Produtório ponderado ∏ qᵢ^wᵢ. Exige ao menos 5 dos 7 parâmetros.
pub fn compute(inp: &IqaInputs) -> Option<f64> {
    let terms = [
        (inp.do_sat_pct.map(q_do_sat), 0.17),
        (inp.coliforms.map(q_coliforms), 0.15),
        (inp.ph.map(q_ph), 0.12),
        (inp.temp_dev.map(q_temp_dev), 0.10),
        (inp.nitrogen.map(q_nitrogen), 0.10),
        (inp.phosphorus.map(q_phosphorus), 0.10),
        (inp.turbidity.map(q_turbidity), 0.08),
    ];
    let avail: Vec<(f64, f64)> = terms.iter().filter_map(|(q, w)| q.map(|q| (q, *w))).collect();
    if avail.len() < 5 {
        return None;
    }
    let wsum: f64 = avail.iter().map(|(_, w)| w).sum();
    let log_iqa: f64 = avail.iter().map(|(q, w)| (w / wsum) * q.max(1.0).ln()).sum();
    Some(log_iqa.exp())
}

/// Categoria CETESB para o valor do IQA.
pub fn class(iqa: f64) -> &'static str {
    match iqa {
        x if x >= 80.0 => "Ótima",
        x if x >= 52.0 => "Boa",
        x if x >= 37.0 => "Regular",
        x if x >= 20.0 => "Ruim",
        _ => "Péssima",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clean_water_scores_high() {
        let iqa = compute(&IqaInputs {
            do_sat_pct: Some(98.0),
            coliforms: Some(10.0),
            ph: Some(7.2),
            temp_dev: Some(0.5),
            nitrogen: Some(0.3),
            phosphorus: Some(0.02),
            turbidity: Some(3.0),
        })
        .unwrap();
        assert!(iqa > 80.0, "iqa = {iqa}");
        assert_eq!(class(iqa), "Ótima");
    }

    #[test]
    fn polluted_water_scores_low() {
        let iqa = compute(&IqaInputs {
            do_sat_pct: Some(25.0),
            coliforms: Some(200_000.0),
            ph: Some(6.0),
            temp_dev: Some(3.0),
            nitrogen: Some(12.0),
            phosphorus: Some(1.5),
            turbidity: Some(120.0),
        })
        .unwrap();
        assert!(iqa < 37.0, "iqa = {iqa}");
    }

    #[test]
    fn requires_enough_parameters() {
        let inp = IqaInputs { ph: Some(7.0), turbidity: Some(5.0), ..Default::default() };
        assert!(compute(&inp).is_none());
    }

    #[test]
    fn do_saturation_at_20c() {
        assert!((do_saturation(20.0) - 9.09).abs() < 0.1);
    }
}
