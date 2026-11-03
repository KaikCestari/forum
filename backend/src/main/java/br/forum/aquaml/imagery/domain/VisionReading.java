package br.forum.aquaml.imagery.domain;

import br.forum.aquaml.shared.domain.BusinessRuleException;
import jakarta.persistence.Embeddable;

import java.util.Set;

/**
 * Objeto de valor com o que foi visto na imagem (pelo modelo com visão e/ou corrigido pelo biólogo).
 *
 * <p>É imutável e sempre válido: turbidez só pode ser baixa, media, alta ou null, e o nível de atenção fica entre
 * 0 e 3. Valores {@code null} significam "não deu para avaliar".
 */
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

    /** Leitura vazia, usada quando a IA falhou e o biólogo vai preencher tudo à mão. */
    public static VisionReading empty() {
        return new VisionReading(null, null, null, null, null, null, null, 0, "");
    }

    /** Nova leitura com as correções do biólogo por cima (campos não informados ficam como estavam). */
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
