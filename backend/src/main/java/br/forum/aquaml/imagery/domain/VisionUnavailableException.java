package br.forum.aquaml.imagery.domain;

public class VisionUnavailableException extends RuntimeException {
    public VisionUnavailableException(String message) {
        super(message);
    }
}
