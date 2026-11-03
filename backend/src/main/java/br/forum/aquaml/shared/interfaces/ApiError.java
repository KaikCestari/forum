package br.forum.aquaml.shared.interfaces;

/** Corpo JSON de erro definido no contrato: {@code {"status": 400, "error": "mensagem"}}. */
public record ApiError(int status, String error) {
}
