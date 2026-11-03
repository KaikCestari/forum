package br.forum.aquaml.imagery.domain;

public record ImageCorrections(String waterColor, String turbidity, Boolean algaeBloom, Boolean foam, Boolean oil,
                               Boolean floatingDebris, Integer attentionLevel, String notes) {

    public static ImageCorrections none() {
        return new ImageCorrections(null, null, null, null, null, null, null, null);
    }
}
