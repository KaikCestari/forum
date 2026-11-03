package br.forum.aquaml.imagery.domain;

import java.util.List;
import java.util.Optional;

public interface WaterImageRepository {

    WaterImage save(WaterImage image);

    Optional<WaterImage> findById(Long id);

    List<WaterImage> findAllByOrderByUploadedAtDescIdDesc();

    List<WaterImage> findByStatusOrderByObservedOnDescIdDesc(ImageStatus status);

    long countByStatus(ImageStatus status);

    long count();

    void delete(WaterImage image);
}
