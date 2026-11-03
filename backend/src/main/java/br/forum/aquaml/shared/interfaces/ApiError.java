package br.forum.aquaml.shared.interfaces;

public record ApiError(int status, String error) {
}
