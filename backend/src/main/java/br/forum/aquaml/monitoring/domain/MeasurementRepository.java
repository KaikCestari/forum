package br.forum.aquaml.monitoring.domain;

import java.time.LocalDateTime;
import java.util.List;

public interface MeasurementRepository {

    List<Measurement> saveAll(Iterable<Measurement> measurements);

    List<Measurement> findAllByOrderByStationIdAscTimestampAsc();

    long count();

    LocalDateTime firstReadingTime();

    LocalDateTime lastReadingTime();

    void removeAll();
}
