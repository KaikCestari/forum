package br.forum.aquaml.identity.interfaces;

import br.forum.aquaml.identity.application.CurrentUser;
import br.forum.aquaml.identity.application.UserService;
import br.forum.aquaml.identity.interfaces.UserDtos.CreateUserRequest;
import br.forum.aquaml.identity.interfaces.UserDtos.UpdateUserRequest;
import br.forum.aquaml.shared.docs.ApiExamples;
import br.forum.aquaml.shared.interfaces.ApiError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@Tag(name = "2. Usuários (ADMIN)", description = "Criar, mudar papel, ativar e apagar contas. Só ADMIN; "
        + "FUNCIONARIO recebe 403.")
@ApiResponse(responseCode = "403", description = "Papel sem permissão (só ADMIN)",
        content = @Content(schema = @Schema(implementation = ApiError.class),
                examples = @ExampleObject(value = ApiExamples.ERR_403)))
public class UserController {

    private final UserService users;

    public UserController(UserService users) {
        this.users = users;
    }

    @GetMapping
    @Operation(summary = "Listar contas",
            responses = @ApiResponse(responseCode = "200", description = "Todas as contas",
                    content = @Content(array = @ArraySchema(schema = @Schema(implementation = UserResponse.class)),
                            examples = @ExampleObject(value = ApiExamples.USER_LIST))))
    public List<UserResponse> list() {
        return users.list().stream().map(UserResponse::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Criar conta",
            description = "Não há cadastro público: o ADMIN cria as contas. Senha com pelo menos 6 caracteres; "
                    + "`role` é `ADMIN` ou `FUNCIONARIO`.",
            requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(
                    mediaType = "application/json", schema = @Schema(implementation = CreateUserRequest.class),
                    examples = {
                            @ExampleObject(name = "FUNCIONARIO", value = ApiExamples.USER_CREATE),
                            @ExampleObject(name = "ADMIN", value = ApiExamples.USER_CREATE_ADMIN)})),
            responses = {
                    @ApiResponse(responseCode = "201", description = "Conta criada",
                            content = @Content(schema = @Schema(implementation = UserResponse.class),
                                    examples = @ExampleObject(value = ApiExamples.USER_FUNCIONARIO))),
                    @ApiResponse(responseCode = "400", description = "E-mail repetido, senha curta ou campo vazio",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_400_EMAIL)))})
    public UserResponse create(@Valid @RequestBody CreateUserRequest body) {
        return UserResponse.from(users.create(body.name(), body.email(), body.password(), body.role()));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Mudar papel, ativar/desativar ou renomear",
            description = "Todos os campos são opcionais: só o que vier preenchido muda. "
                    + "Ninguém tira o próprio papel de ADMIN nem desativa a própria conta.",
            requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(
                    mediaType = "application/json", schema = @Schema(implementation = UpdateUserRequest.class),
                    examples = {
                            @ExampleObject(name = "Promover a ADMIN", value = ApiExamples.USER_PROMOTE),
                            @ExampleObject(name = "Desativar", value = ApiExamples.USER_DEACTIVATE),
                            @ExampleObject(name = "Renomear", value = ApiExamples.USER_RENAME)})),
            responses = {
                    @ApiResponse(responseCode = "200", description = "Conta alterada",
                            content = @Content(schema = @Schema(implementation = UserResponse.class),
                                    examples = @ExampleObject(value = ApiExamples.USER_FUNCIONARIO))),
                    @ApiResponse(responseCode = "404", description = "Conta não existe",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_404_USER)))})
    public UserResponse update(@Parameter(example = "2") @PathVariable Long id, @RequestBody UpdateUserRequest body,
                               @AuthenticationPrincipal CurrentUser current) {
        return UserResponse.from(users.update(id, body.role(), body.active(), body.name(), current));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Apagar conta", description = "O ADMIN não pode apagar a própria conta.",
            responses = {
                    @ApiResponse(responseCode = "204", description = "Conta apagada"),
                    @ApiResponse(responseCode = "400", description = "Tentou apagar a si mesmo",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_400_SELF))),
                    @ApiResponse(responseCode = "404", description = "Conta não existe",
                            content = @Content(schema = @Schema(implementation = ApiError.class),
                                    examples = @ExampleObject(value = ApiExamples.ERR_404_USER)))})
    public void delete(@Parameter(example = "2") @PathVariable Long id, @AuthenticationPrincipal CurrentUser current) {
        users.delete(id, current);
    }
}
