package br.forum.aquaml.analysis.domain;

/**
 * Objeto de valor IQA (Índice de Qualidade da Água, 0 a 100, fórmula CETESB/NSF) com a classificação oficial:
 * Ótima (≥80), Boa (≥52), Regular (≥37), Ruim (≥20) e Péssima (&lt;20).
 */
public record Iqa(double value) {

    public Iqa {
        if (Double.isNaN(value) || value < 0 || value > 100) {
            throw new IllegalArgumentException("IQA deve ficar entre 0 e 100");
        }
    }

    /** Classe do IQA em português, como aparece na tela. */
    public String classification() {
        if (value >= 80) {
            return "Ótima";
        }
        if (value >= 52) {
            return "Boa";
        }
        if (value >= 37) {
            return "Regular";
        }
        if (value >= 20) {
            return "Ruim";
        }
        return "Péssima";
    }

    /** Estação "em risco" no painel: IQA abaixo de Boa (Regular, Ruim ou Péssima). */
    public boolean isAtRisk() {
        return value < 52;
    }
}
