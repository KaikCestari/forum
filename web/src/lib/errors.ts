export const ASSISTANT_UNAVAILABLE = "O assistente está indisponível no momento. Tente novamente em alguns instantes.";
export const REQUEST_FAILED = "Não foi possível concluir a solicitação. Tente novamente em alguns instantes.";

export function requestErrorMessage(status: number, message: unknown): string {
  return status < 500 && typeof message === "string" ? message : REQUEST_FAILED;
}

/** Usa apenas códigos conhecidos, nunca mensagens de exceções ou do provedor. */
export function assistantErrorMessage(error: unknown): string {
  const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
  if (status === 401) return "Sua sessão terminou. Entre novamente para continuar.";
  if (status === 400 || status === 422) return "Confira sua pergunta e tente novamente.";
  if (status === 429) return "Muitas solicitações. Aguarde um momento e tente novamente.";
  return ASSISTANT_UNAVAILABLE;
}
