package br.forum.aquaml.identity.interfaces;

import br.forum.aquaml.identity.application.AuthService;
import br.forum.aquaml.identity.application.CurrentUser;
import br.forum.aquaml.identity.interfaces.AuthDtos.LoginRequest;
import br.forum.aquaml.identity.interfaces.AuthDtos.LoginResponse;
import br.forum.aquaml.shared.docs.ApiExamples;
import br.forum.aquaml.shared.interfaces.ApiError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "1. Login", description = "Entrar e ver o usuário logado (JWT)")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/login")
    @SecurityRequirements
    @Operation(summary = "Entrar e receber o token JWT",
            description = "Rota aberta. Copie o `token` da resposta e cole no botão **Authorize** (cadeado) "
                    + "no topo da página. O token vale 8 horas.",
            requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(
                    mediaType = "application/json", schema = @Schema(implementation = LoginRequest.class),
                    examples = {
                            @ExampleObject(name = "ADMIN", summary = "Administrador padrão", value = ApiExamples.LOGIN_ADMIN),
                            @ExampleObject(name = "FUNCIONARIO", summary = "Funcionária (crie antes em POST /api/users)",
                                    value = ApiExamples.LOGIN_FUNCIONARIO),
                            @ExampleObject(name = "Senha errada", summary = "Recebe 401", value = ApiExamples.LOGIN_WRONG)})),
            responses = {
                    @ApiResponse(responseCode = "200", description = "Login feito",
                            content = @Content(schema = @Schema(implementation = LoginResponse.class),
                                    examples = @ExampleObject(value = ApiExamples.LOGIN_RESPONSE))),
                    @ApiResponse(responseCode = "400", description = "Campo vazio",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_400))),
                    @ApiResponse(responseCode = "401", description = "E-mail ou senha incorretos (ou conta desativada)",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_401_LOGIN)))})
    public LoginResponse login(@Valid @RequestBody LoginRequest body) {
        var result = auth.login(body.email(), body.password());
        return new LoginResponse(result.token(), result.expiresAt(), UserResponse.from(result.user()));
    }

    @GetMapping("/me")
    @Operation(summary = "Usuário logado", description = "Devolve quem é o dono do token enviado.",
            responses = @ApiResponse(responseCode = "200", description = "Usuário do token",
                    content = @Content(schema = @Schema(implementation = UserResponse.class),
                            examples = @ExampleObject(value = ApiExamples.USER_ADMIN))))
    public UserResponse me(@AuthenticationPrincipal CurrentUser current) {
        return UserResponse.from(auth.me(current));
    }
}
