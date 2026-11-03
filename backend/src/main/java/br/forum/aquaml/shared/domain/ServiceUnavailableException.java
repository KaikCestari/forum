package br.forum.aquaml.shared.domain;

/** Um serviço externo (Ollama ou serviço de ML) não respondeu (vira HTTP 503). */
public class ServiceUnavailableException extends RuntimeException {
    public ServiceUnavailableException(String message) {
        super(message);
    }

    public ServiceUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
