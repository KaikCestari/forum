package br.forum.aquaml.monitoring.infrastructure.persistence;

import br.forum.aquaml.monitoring.domain.Station;
import br.forum.aquaml.monitoring.domain.StationRepository;
import org.springframework.data.repository.Repository;

/** Adaptador JPA da porta {@link StationRepository} (implementação gerada pelo Spring Data). */
public interface JpaStationRepository extends Repository<Station, String>, StationRepository {
}
