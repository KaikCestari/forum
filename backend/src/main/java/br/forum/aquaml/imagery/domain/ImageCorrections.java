package br.forum.aquaml.imagery.domain;

/**
 * Objeto de valor com o que o biólogo corrigiu ao conferir a imagem. Todos os campos são opcionais;
 * {@code notes} é um comentário livre de quem conferiu.
 */
public record ImageCorrections(String waterColor, String turbidity, Boolean algaeBloom, Boolean foam, Boolean oil,
                               Boolean floatingDebris, Integer attentionLevel, String notes) {

    public static ImageCorrections none() {
        return new ImageCorrections(null, null, null, null, null, null, null, null);
    }
}
