package br.forum.aquaml.imagery.domain;

public interface VisionAnalyzer {

    VisionReading read(byte[] jpeg, String kind);
}
