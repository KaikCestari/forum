package br.forum.aquaml.identity.interfaces;

import jakarta.validation.constraints.NotBlank;

import java.time.Instant;

/** DTOs (formatos JSON) das rotas de autenticação. */
public final class AuthDtos {

    private AuthDtos() {
    }

    public record LoginRequest(@NotBlank(message = "informe o e-mail") String email,
                               @NotBlank(message = "informe a senha") String password) {
    }

    public record LoginResponse(String token, Instant expiresAt, UserResponse user) {
    }
}
