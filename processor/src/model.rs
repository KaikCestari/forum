//! Tipos de dados e definição dos parâmetros monitorados.

use chrono::{NaiveDate, NaiveDateTime};

/// Número de parâmetros físico-químicos/biológicos monitorados.
pub const N_PARAMS: usize = 8;

/// Definição de um parâmetro: nome da coluna e faixa fisicamente plausível.
pub struct Param {
    pub name: &'static str,
    pub min: f64,
    pub max: f64,
}

/// Ordem fixa dos parâmetros em todos os vetores `[Option<f64>; N_PARAMS]`.
pub const PARAMS: [Param; N_PARAMS] = [
    Param { name: "ph", min: 0.0, max: 14.0 },
    Param { name: "do_mgl", min: 0.0, max: 25.0 },
    Param { name: "temp_c", min: -2.0, max: 45.0 },
    Param { name: "turbidity_ntu", min: 0.0, max: 4000.0 },
    Param { name: "conductivity_uscm", min: 0.0, max: 100_000.0 },
    Param { name: "nitrate_mgl", min: 0.0, max: 500.0 },
    Param { name: "phosphorus_mgl", min: 0.0, max: 50.0 },
    Param { name: "coliforms_nmp", min: 0.0, max: 1.0e8 },
];

pub const PH: usize = 0;
pub const DO: usize = 1;
pub const TEMP: usize = 2;
pub const TURB: usize = 3;
pub const NITRATE: usize = 5;
pub const PHOSPHORUS: usize = 6;
pub const COLIFORMS: usize = 7;

pub type Values = [Option<f64>; N_PARAMS];

/// Uma leitura horária bruta de uma estação.
#[derive(Debug, Clone)]
pub struct Reading {
    pub time: NaiveDateTime,
    pub values: Values,
}

/// Registro diário consolidado, pronto para a etapa de ML.
#[derive(Debug, Clone)]
pub struct DailyRow {
    pub station_id: String,
    pub date: NaiveDate,
    /// Fração das horas do dia com ao menos uma leitura válida.
    pub coverage: f64,
    pub values: Values,
    pub ma7: Values,
    pub z30: Values,
    pub do_sat_pct: Option<f64>,
    pub iqa: Option<f64>,
}
