/** Somente caminhos internos podem ser usados depois da autenticação. */
export function safeReturnPath(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return "/";
  const url = new URL(value, "https://aquaml.local");
  if (
    url.origin !== "https://aquaml.local" ||
    /^\/(login|cadastro)(\/|$)/.test(url.pathname)
  )
    return "/";
  return url.pathname + url.search + url.hash;
}
