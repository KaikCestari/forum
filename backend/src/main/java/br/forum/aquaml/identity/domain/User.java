package br.forum.aquaml.identity.domain;

import br.forum.aquaml.shared.domain.BusinessRuleException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Locale;

/**
 * Entidade (agregado) Usuário: uma pessoa da equipe que entra no sistema.
 *
 * <p>As regras ficam aqui dentro, e não espalhadas nos serviços: o e-mail é sempre guardado em minúsculas, o
 * nome não pode ficar vazio e ninguém pode tirar o próprio acesso de administrador.
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, unique = true, length = 160)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    private boolean active = true;

    private Instant createdAt;

    protected User() {
        // exigido pelo JPA
    }

    public User(String name, String email, String passwordHash, Role role) {
        rename(name);
        this.email = normalizeEmail(email);
        this.passwordHash = passwordHash;
        this.role = role == null ? Role.FUNCIONARIO : role;
        this.createdAt = Instant.now();
    }

    /** E-mail em minúsculas e sem espaços, para o login não depender de maiúsculas. */
    public static String normalizeEmail(String email) {
        if (email == null || !email.strip().contains("@")) {
            throw new BusinessRuleException("Informe um e-mail válido.");
        }
        return email.strip().toLowerCase(Locale.ROOT);
    }

    public void rename(String newName) {
        if (newName == null || newName.isBlank()) {
            throw new BusinessRuleException("O nome não pode ficar vazio.");
        }
        this.name = newName.strip();
    }

    /** Troca o papel. Quem está fazendo a mudança não pode rebaixar a si mesmo (evita ficar sem administrador). */
    public void changeRole(Role newRole, Long changedBy) {
        if (newRole == null) {
            return;
        }
        if (id != null && id.equals(changedBy) && role == Role.ADMIN && newRole != Role.ADMIN) {
            throw new BusinessRuleException("Você não pode tirar o seu próprio papel de administrador.");
        }
        this.role = newRole;
    }

    /** Ativa ou desativa a conta. Uma conta desativada não consegue entrar. */
    public void setActive(boolean value, Long changedBy) {
        if (!value && id != null && id.equals(changedBy)) {
            throw new BusinessRuleException("Você não pode desativar a sua própria conta.");
        }
        this.active = value;
    }

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public Role getRole() {
        return role;
    }

    public boolean isActive() {
        return active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
