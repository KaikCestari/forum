package br.forum.aquaml.monitoring.domain;

import java.time.LocalDateTime;
import java.util.List;

/** Porta do repositório de leituras dos sensores. */
public interface MeasurementRepository {

    List<Measurement> saveAll(Iterable<Measurement> measurements);

    List<Measurement> findAllByOrderByStationIdAscTimestampAsc();

    long count();

    /** Data/hora da primeira leitura, ou null se não houver leituras. */
    LocalDateTime firstReadingTime();

    /** Data/hora da última leitura, ou null se não houver leituras. */
    LocalDateTime lastReadingTime();

    /** Apaga todas as leituras de uma vez. */
    void removeAll();
}
