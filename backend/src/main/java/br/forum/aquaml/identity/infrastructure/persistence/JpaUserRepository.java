package br.forum.aquaml.identity.infrastructure.persistence;

import br.forum.aquaml.identity.domain.User;
import br.forum.aquaml.identity.domain.UserRepository;
import org.springframework.data.repository.Repository;

/**
 * Adaptador JPA da porta {@link UserRepository}. É só uma interface: o Spring Data gera a implementação
 * dos métodos declarados na porta do domínio.
 */
public interface JpaUserRepository extends Repository<User, Long>, UserRepository {
}
