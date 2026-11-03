package br.forum.aquaml.identity.infrastructure.security;

import br.forum.aquaml.identity.application.TokenIssuer;
import br.forum.aquaml.identity.domain.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

/**
 * Emite e confere tokens JWT (HS256, validade de 8 horas). Claims: {@code sub} = id do usuário,
 * {@code email} e {@code role}.
 *
 * <p>O segredo vem de {@code JWT_SECRET}. Se não existir, é gerado um aleatório no início
 * (os tokens deixam de valer quando o servidor reinicia) e um aviso vai para o log, sem mostrar o segredo.
 */
@Component
public class JwtService implements TokenIssuer {

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);
    private static final Duration VALIDITY = Duration.ofHours(8);
    private static final int MIN_SECRET_LENGTH = 32;

    private final SecretKey key;

    public JwtService(@Value("${aquaml.jwt.secret:}") String secret) {
        this.key = Keys.hmacShaKeyFor(secretBytes(secret));
    }

    private static byte[] secretBytes(String secret) {
        if (secret == null || secret.isBlank()) {
            log.warn("JWT_SECRET não definido: gerando um segredo aleatório. Os logins valem só até o servidor reiniciar.");
            byte[] random = new byte[48];
            new SecureRandom().nextBytes(random);
            return random;
        }
        if (secret.length() < MIN_SECRET_LENGTH) {
            throw new IllegalStateException("JWT_SECRET precisa ter pelo menos " + MIN_SECRET_LENGTH + " caracteres.");
        }
        return secret.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public IssuedToken issue(User user) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(VALIDITY);
        String token = Jwts.builder()
                .subject(String.valueOf(user.getId()))
                .claim("email", user.getEmail())
                .claim("role", user.getRole().name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiresAt))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
        return new IssuedToken(token, expiresAt);
    }

    /** Id do usuário dono do token, ou vazio se o token for inválido ou estiver vencido. */
    public Optional<Long> userIdFrom(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            return Optional.of(Long.valueOf(claims.getSubject()));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
