// Verifica autenticação, serialização, erros e arquivos no único cliente HTTP.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroApi, EVENTO_SESSAO_EXPIRADA, requisicao, sessao, urlImagem } from './cliente';
import { api } from './recursos';
import { criarAnaliseParcial } from '../test/analiseParcial';
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  localStorage.clear();
});
function responder(dados: unknown, status = 200) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(dados), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}
describe('cliente HTTP', () => {
  it('preserva os campos null e os oito sensores retornados pelo ML', async () => {
    const analise = criarAnaliseParcial();
    analise.anomalies.episodes = [
      {
        stationId: 'rio-a',
        start: '2026-11-01',
        end: '2026-11-03',
        days: 3,
        maxScore: null,
        parameters: ['ph'],
      },
    ];
    responder(analise);
    await expect(api.analise()).resolves.toEqual(analise);
  });
  it('adiciona a base e o JWT ao cabeçalho', async () => {
    sessao.salvar('token-de-teste');
    responder({ hasData: false });
    await requisicao('/dashboard');
    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/dashboard');
    expect(new Headers(opcoes?.headers).get('Authorization')).toBe('Bearer token-de-teste');
  });
  it('envia email e password no login aberto, sem JWT', async () => {
    sessao.salvar('antigo');
    responder({ token: 'novo' });
    await api.login('pessoa@aquaml.local', 'senha');
    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(opcoes?.method).toBe('POST');
    expect(opcoes?.body).toBe(JSON.stringify({ email: 'pessoa@aquaml.local', password: 'senha' }));
    expect(new Headers(opcoes?.headers).get('Authorization')).toBeNull();
    expect(new Headers(opcoes?.headers).get('Content-Type')).toBe('application/json');
  });
  it('preserva FormData e deixa o navegador definir seu boundary', async () => {
    const body = new FormData();
    body.append('file', new File(['foto'], 'agua.png', { type: 'image/png' }));
    responder({ id: 1 });
    await api.enviarImagem(body);
    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/images');
    expect(opcoes?.body).toBe(body);
    expect(new Headers(opcoes?.headers).has('Content-Type')).toBe(false);
  });
  it('aceita 204 da análise e de exclusões sem tentar ler JSON', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api.analise()).resolves.toBeUndefined();
    await expect(api.apagarDados()).resolves.toBeUndefined();
  });
  it('preserva a mensagem error e o código enviados pelo backend', async () => {
    responder({ status: 503, error: 'Serviço de análise indisponível.' }, 503);
    await expect(api.rodarAnalise()).rejects.toMatchObject({
      status: 503,
      message: 'Serviço de análise indisponível.',
    });
  });
  it('limpa o token e notifica a aplicação quando a sessão recebe 401', async () => {
    sessao.salvar('expirado');
    const evento = vi.fn();
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, evento);
    responder({ error: 'Token inválido.' }, 401);
    await expect(api.eu()).rejects.toBeInstanceOf(ErroApi);
    expect(sessao.token()).toBeNull();
    expect(evento).toHaveBeenCalledTimes(1);
    window.removeEventListener(EVENTO_SESSAO_EXPIRADA, evento);
  });
  it('mostra credenciais inválidas sem tratar o login aberto como sessão expirada', async () => {
    const evento = vi.fn();
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, evento);
    responder({ error: 'Email ou senha inválidos.' }, 401);
    await expect(api.login('pessoa@exemplo.com', 'incorreta')).rejects.toThrow(
      'Email ou senha inválidos.',
    );
    expect(evento).not.toHaveBeenCalled();
    window.removeEventListener(EVENTO_SESSAO_EXPIRADA, evento);
  });
  it('mantém a sessão em 403 e apresenta a mensagem de permissão', async () => {
    sessao.salvar('valido');
    responder({ error: 'Sem permissão.' }, 403);
    await expect(api.usuarios()).rejects.toThrow('Sem permissão.');
    expect(sessao.token()).toBe('valido');
  });
  it('trata erro HTTP com resposta não JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Falha</html>', { status: 502 }));
    await expect(api.painel()).rejects.toMatchObject({ status: 502 });
  });
  it('traduz falha de rede e preserva cancelamentos', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(api.painel()).rejects.toThrow('Não foi possível conectar ao servidor.');
    const aborto = new DOMException('Cancelado', 'AbortError');
    fetchMock.mockRejectedValueOnce(aborto);
    await expect(api.painel()).rejects.toBe(aborto);
  });
  it('encaminha o sinal de cancelamento e codifica identificadores de estação', async () => {
    const controle = new AbortController();
    responder({ dates: [] });
    await api.serie('rio/a & b', controle.signal);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/stations/rio%2Fa%20%26%20b/series');
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controle.signal);
  });
  it('envia apenas question ao modelo fixo do assistente', async () => {
    responder({ answer: 'Resposta' });
    await api.perguntar('O que mudou?');
    expect(fetchMock.mock.calls[0][1]?.body).toBe('{"question":"O que mudou?"}');
  });
});
describe('arquivos autenticados', () => {
  it('acrescenta o JWT codificado ao fileUrl sem perder parâmetros existentes', () => {
    sessao.salvar('a+b/c=');
    expect(urlImagem('/api/images/7/file?tamanho=grande')).toBe(
      '/api/images/7/file?tamanho=grande&token=a%2Bb%2Fc%3D',
    );
  });
  it('não vaza o JWT para outro domínio ou para uma rota fora dos arquivos', () => {
    sessao.salvar('segredo');
    expect(urlImagem('https://outro.exemplo/api/images/1/file')).toBe('');
    expect(urlImagem('/outro/caminho')).toBe('');
  });
});
