package br.forum.aquaml.monitoring.infrastructure.persistence;

import br.forum.aquaml.monitoring.domain.Station;
import br.forum.aquaml.monitoring.domain.StationRepository;
import org.springframework.data.repository.Repository;

public interface JpaStationRepository extends Repository<Station, String>, StationRepository {
}
