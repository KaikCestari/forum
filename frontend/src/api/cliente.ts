const CHAVE_TOKEN = 'aquaml.token';
export const EVENTO_SESSAO_EXPIRADA = 'aquaml:sessao-expirada';
export const sessao = {
  token: () => localStorage.getItem(CHAVE_TOKEN),
  salvar: (token: string) => localStorage.setItem(CHAVE_TOKEN, token),
  limpar: () => localStorage.removeItem(CHAVE_TOKEN),
};
export class ErroApi extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroApi';
  }
}
interface Opcoes extends Omit<RequestInit, 'body'> {
  body?: unknown;
  publico?: boolean;
}
export async function requisicao<T>(
  rota: string,
  { body, publico = false, ...opcoes }: Opcoes = {},
): Promise<T> {
  const headers = new Headers(opcoes.headers);
  const token = sessao.token();
  if (!publico && token) headers.set('Authorization', `Bearer ${token}`);
  const multipart = body instanceof FormData;
  if (body !== undefined && !multipart) headers.set('Content-Type', 'application/json');
  let resposta: Response;
  try {
    resposta = await fetch(`/api${rota}`, {
      ...opcoes,
      headers,
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
    });
  } catch (erro) {
    if (erro && typeof erro === 'object' && 'name' in erro && erro.name === 'AbortError')
      throw erro;
    throw new ErroApi(
      0,
      'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
    );
  }
  if (!resposta.ok) {
    const dados = (await resposta.json().catch(() => null)) as { error?: string } | null;
    if (resposta.status === 401 && !publico) {
      sessao.limpar();
      window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA));
    }
    throw new ErroApi(
      resposta.status,
      dados?.error || `Não foi possível concluir a solicitação (${resposta.status}).`,
    );
  }
  if (resposta.status === 204) return undefined as T;
  return resposta.json() as Promise<T>;
}
export function urlImagem(fileUrl: string): string {
  const url = new URL(fileUrl, window.location.origin);
  // só manda o token para arquivos da própria API
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/images/')) return '';
  const token = sessao.token();
  if (token) url.searchParams.set('token', token);
  return `${url.pathname}${url.search}`;
}
