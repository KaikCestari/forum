package br.forum.aquaml.imagery.domain;

/** Porta para guardar os arquivos das imagens (em disco, na pasta data/images). */
public interface ImageStorage {

    /** Guarda os bytes e devolve o nome do arquivo gerado. */
    String store(byte[] data, String extension);

    byte[] load(String fileName);

    void delete(String fileName);
}
