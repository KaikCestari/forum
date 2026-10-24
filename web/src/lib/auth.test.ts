import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./auth";

describe("destino após a autenticação", () => {
  it("preserva caminhos, filtros e âncoras internos", () => {
    expect(safeReturnPath("/dados?aba=importar#leituras")).toBe(
      "/dados?aba=importar#leituras",
    );
  });
  it("bloqueia endereços externos e ciclos de autenticação", () => {
    for (const value of [
      null,
      "https://outro.site",
      "//outro.site",
      "/\\outro.site",
      "/\noutro.site",
      "/login?retorno=/",
      "/cadastro",
    ])
      expect(safeReturnPath(value)).toBe("/");
  });
});
