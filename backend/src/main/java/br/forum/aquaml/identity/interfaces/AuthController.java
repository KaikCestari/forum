package br.forum.aquaml.identity.interfaces;

import br.forum.aquaml.identity.application.AuthService;
import br.forum.aquaml.identity.application.CurrentUser;
import br.forum.aquaml.identity.interfaces.AuthDtos.LoginRequest;
import br.forum.aquaml.identity.interfaces.AuthDtos.LoginResponse;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Rotas de login ({@code /api/auth}). O login é a única rota aberta, sem token. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest body) {
        var result = auth.login(body.email(), body.password());
        return new LoginResponse(result.token(), result.expiresAt(), UserResponse.from(result.user()));
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal CurrentUser current) {
        return UserResponse.from(auth.me(current));
    }
}
