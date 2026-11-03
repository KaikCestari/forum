package br.forum.aquaml.imagery.domain;

/**
 * Situação da imagem: {@code PENDENTE} (lida pela IA, falta o biólogo conferir), {@code CONFIRMADA} (conferida)
 * ou {@code ERRO_ANALISE} (a IA não conseguiu ler; o biólogo preenche à mão ao confirmar).
 */
public enum ImageStatus {
    PENDENTE,
    CONFIRMADA,
    ERRO_ANALISE
}
