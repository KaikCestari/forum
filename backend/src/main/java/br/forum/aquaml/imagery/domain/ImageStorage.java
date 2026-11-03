package br.forum.aquaml.imagery.domain;

public interface ImageStorage {

    String store(byte[] data, String extension);

    byte[] load(String fileName);

    void delete(String fileName);
}
