package br.forum.aquaml.analysis.domain;

public record Iqa(double value) {

    public Iqa {
        if (Double.isNaN(value) || value < 0 || value > 100) {
            throw new IllegalArgumentException("IQA deve ficar entre 0 e 100");
        }
    }

    public boolean isAtRisk() {
        return value < 52;
    }
}
