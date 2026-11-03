package br.forum.aquaml.imagery.domain;

/** Porta para o modelo com visão que descreve a imagem. A implementação (Ollama) fica na infraestrutura. */
public interface VisionAnalyzer {

    /**
     * @param jpeg imagem já reduzida, em JPEG
     * @param kind {@code foto} ou {@code satelite}
     * @throws VisionUnavailableException se o modelo não respondeu ou respondeu algo ilegível
     */
    VisionReading read(byte[] jpeg, String kind);
}
