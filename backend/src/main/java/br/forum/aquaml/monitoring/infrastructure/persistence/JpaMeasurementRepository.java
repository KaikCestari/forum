package br.forum.aquaml.monitoring.infrastructure.persistence;

import br.forum.aquaml.monitoring.domain.Measurement;
import br.forum.aquaml.monitoring.domain.MeasurementRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** Adaptador JPA da porta {@link MeasurementRepository}; as consultas especiais ficam aqui em JPQL. */
public interface JpaMeasurementRepository extends Repository<Measurement, Long>, MeasurementRepository {

    @Override
    @Query("select min(m.timestamp) from Measurement m")
    LocalDateTime firstReadingTime();

    @Override
    @Query("select max(m.timestamp) from Measurement m")
    LocalDateTime lastReadingTime();

    @Override
    @Modifying
    @Transactional
    @Query("delete from Measurement m")
    void removeAll();
}
