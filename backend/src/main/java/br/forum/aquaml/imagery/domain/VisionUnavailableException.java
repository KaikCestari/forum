package br.forum.aquaml.imagery.domain;

/** O modelo com visão não conseguiu ler a imagem; a mensagem vai para {@code analysisError}. */
public class VisionUnavailableException extends RuntimeException {
    public VisionUnavailableException(String message) {
        super(message);
    }
}
