package br.forum.aquaml.imagery.domain;

import br.forum.aquaml.shared.domain.BusinessRuleException;
import jakarta.persistence.Embeddable;

import java.util.Set;

@Embeddable
public record VisionReading(String waterColor, String turbidity, Boolean algaeBloom, Boolean foam, Boolean oil,
                            Boolean floatingDebris, String surroundings, Integer attentionLevel, String summary) {

    public static final Set<String> TURBIDITY_LEVELS = Set.of("baixa", "media", "alta");

    public VisionReading {
        if (turbidity != null && !TURBIDITY_LEVELS.contains(turbidity)) {
            throw new BusinessRuleException("Turbidez deve ser baixa, media ou alta.");
        }
        if (attentionLevel == null) {
            attentionLevel = 0;
        }
        if (attentionLevel < 0 || attentionLevel > 3) {
            throw new BusinessRuleException("O nível de atenção vai de 0 a 3.");
        }
        waterColor = clean(waterColor, 80);
        surroundings = clean(surroundings, 200);
        summary = summary == null ? "" : summary.strip();
        if (summary.length() > 600) {
            summary = summary.substring(0, 600);
        }
    }

    public static VisionReading empty() {
        return new VisionReading(null, null, null, null, null, null, null, 0, "");
    }

    public VisionReading correctedWith(ImageCorrections c) {
        return new VisionReading(
                c.waterColor() != null ? c.waterColor() : waterColor,
                c.turbidity() != null ? c.turbidity() : turbidity,
                c.algaeBloom() != null ? c.algaeBloom() : algaeBloom,
                c.foam() != null ? c.foam() : foam,
                c.oil() != null ? c.oil() : oil,
                c.floatingDebris() != null ? c.floatingDebris() : floatingDebris,
                surroundings,
                c.attentionLevel() != null ? c.attentionLevel() : attentionLevel,
                summary);
    }

    private static String clean(String s, int max) {
        if (s == null || s.isBlank()) {
            return null;
        }
        String t = s.strip();
        return t.length() <= max ? t : t.substring(0, max);
    }
}
