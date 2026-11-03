package br.forum.aquaml.identity.application;

import br.forum.aquaml.identity.domain.User;
import br.forum.aquaml.identity.domain.UserRepository;
import br.forum.aquaml.shared.domain.NotFoundException;
import br.forum.aquaml.shared.domain.UnauthorizedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/** Casos de uso de autenticação: entrar no sistema e saber quem está logado. */
@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final TokenIssuer tokenIssuer;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder, TokenIssuer tokenIssuer) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.tokenIssuer = tokenIssuer;
    }

    /** Confere e-mail e senha e devolve um token válido por 8 horas. */
    public LoginResult login(String email, String password) {
        String normalized = email == null ? "" : email.strip().toLowerCase(java.util.Locale.ROOT);
        User user = users.findByEmail(normalized)
                .filter(u -> password != null && passwordEncoder.matches(password, u.getPasswordHash()))
                .orElseThrow(() -> new UnauthorizedException("E-mail ou senha incorretos."));
        if (!user.isActive()) {
            throw new UnauthorizedException("Esta conta está desativada. Fale com o administrador.");
        }
        TokenIssuer.IssuedToken token = tokenIssuer.issue(user);
        return new LoginResult(token.token(), token.expiresAt(), user);
    }

    /** Dados do usuário logado. */
    public User me(CurrentUser current) {
        return users.findById(current.id()).orElseThrow(() -> new NotFoundException("Usuário não encontrado."));
    }

    public record LoginResult(String token, java.time.Instant expiresAt, User user) {
    }
}
