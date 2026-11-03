package br.forum.aquaml.identity.application;

import br.forum.aquaml.identity.domain.User;

import java.time.Instant;

public interface TokenIssuer {

    IssuedToken issue(User user);

    record IssuedToken(String token, Instant expiresAt) {
    }
}
