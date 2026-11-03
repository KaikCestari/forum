package br.forum.aquaml.imagery.infrastructure.storage;

import br.forum.aquaml.imagery.domain.ImageStorage;
import br.forum.aquaml.shared.domain.NotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.util.UUID;

@Component
public class LocalImageStorage implements ImageStorage {

    private final Path dir;

    public LocalImageStorage(@Value("${aquaml.storage.images-dir}") String dir) {
        this.dir = Path.of(dir).toAbsolutePath().normalize();
    }

    @Override
    public String store(byte[] data, String extension) {
        String name = UUID.randomUUID() + "." + extension;
        try {
            Files.createDirectories(dir);
            Files.write(resolve(name), data);
            return name;
        } catch (IOException e) {
            throw new UncheckedIOException("Não foi possível gravar a imagem", e);
        }
    }

    @Override
    public byte[] load(String fileName) {
        try {
            return Files.readAllBytes(resolve(fileName));
        } catch (NoSuchFileException e) {
            throw new NotFoundException("O arquivo desta imagem não foi encontrado.");
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public void delete(String fileName) {
        try {
            Files.deleteIfExists(resolve(fileName));
        } catch (IOException ignored) {
            // o registro já foi apagado; arquivo órfão não atrapalha
        }
    }

    private Path resolve(String fileName) {
        Path p = dir.resolve(fileName).normalize();
        if (!p.startsWith(dir)) {
            throw new IllegalArgumentException("arquivo fora da pasta de imagens");
        }
        return p;
    }
}
