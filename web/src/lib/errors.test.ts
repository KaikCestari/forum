import { describe, expect, it } from "vitest";
import { ASSISTANT_UNAVAILABLE, REQUEST_FAILED, assistantErrorMessage, requestErrorMessage } from "./errors";

describe("mensagens públicas do assistente", () => {
  it("nunca renderiza mensagens técnicas, mesmo em respostas antigas", () => {
    const detail = "http://localhost:11434 /srv/app/.env secret-token ollama serve stack trace";
    for (const error of [new Error(detail), { status: 503, message: detail }, { status: 500, message: detail }, detail, null]) {
      expect(assistantErrorMessage(error)).toBe(ASSISTANT_UNAVAILABLE);
    }
  });
  it("mantém orientações úteis por tipo de erro", () => {
    expect(assistantErrorMessage({ status: 401 })).toContain("sessão terminou");
    expect(assistantErrorMessage({ status: 400 })).toContain("pergunta");
    expect(assistantErrorMessage({ status: 429 })).toContain("Aguarde");
  });
  it("oculta erros internos sem perder validações de formulário", () => {
    expect(requestErrorMessage(500, "SELECT password_hash FROM auth_users /srv/app/.env")).toBe(REQUEST_FAILED);
    expect(requestErrorMessage(502, "http://localhost:11434 traceback")).toBe(REQUEST_FAILED);
    expect(requestErrorMessage(400, "Informe um e-mail válido.")).toBe("Informe um e-mail válido.");
    expect(requestErrorMessage(409, { stack: "internal" })).toBe(REQUEST_FAILED);
  });
});
