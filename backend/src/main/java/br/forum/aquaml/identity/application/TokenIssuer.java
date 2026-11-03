package br.forum.aquaml.identity.application;

import br.forum.aquaml.identity.domain.User;

import java.time.Instant;

/** Porta para emitir o token de login. A implementação (JWT) fica na infraestrutura. */
public interface TokenIssuer {

    IssuedToken issue(User user);

    record IssuedToken(String token, Instant expiresAt) {
    }
}
