package br.forum.aquaml.analysis.domain;

/** O serviço de ML não conseguiu analisar; a mensagem (em português) vai para o campo {@code error} da execução. */
public class MlServiceException extends RuntimeException {
    public MlServiceException(String message) {
        super(message);
    }
}
