package br.forum.aquaml.identity.infrastructure.persistence;

import br.forum.aquaml.identity.domain.User;
import br.forum.aquaml.identity.domain.UserRepository;
import org.springframework.data.repository.Repository;

public interface JpaUserRepository extends Repository<User, Long>, UserRepository {
}
