package br.forum.aquaml.imagery.infrastructure.persistence;

import br.forum.aquaml.imagery.domain.WaterImage;
import br.forum.aquaml.imagery.domain.WaterImageRepository;
import org.springframework.data.repository.Repository;

public interface JpaWaterImageRepository extends Repository<WaterImage, Long>, WaterImageRepository {
}
