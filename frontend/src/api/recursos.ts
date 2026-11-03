// Reúne as rotas do contrato; componentes não precisam montar URLs ou cabeçalhos.
import { requisicao } from './cliente';
import type {
  Anotacao,
  ConfirmacaoImagem,
  Estacao,
  ExecucaoAnalise,
  ImagemAgua,
  Importacao,
  LoginResposta,
  MensagemChat,
  NovaAnotacao,
  NovaEstacao,
  NovoUsuario,
  Painel,
  ResultadoAnalise,
  ResumoDados,
  Serie,
  StatusAssistente,
  Usuario,
} from './tipos';
const id = (valor: string | number) => encodeURIComponent(valor);
export const api = {
  login: (email: string, password: string) =>
    requisicao<LoginResposta>('/auth/login', {
      method: 'POST',
      body: { email, password },
      publico: true,
    }),
  eu: (signal?: AbortSignal) => requisicao<Usuario>('/auth/me', { signal }),
  painel: (signal?: AbortSignal) => requisicao<Painel>('/dashboard', { signal }),
  estacoes: (signal?: AbortSignal) => requisicao<Estacao[]>('/stations', { signal }),
  criarEstacao: (body: NovaEstacao) => requisicao<Estacao>('/stations', { method: 'POST', body }),
  serie: (estacao: string, signal?: AbortSignal) =>
    requisicao<Serie>(`/stations/${id(estacao)}/series`, { signal }),
  analise: (signal?: AbortSignal) =>
    requisicao<ResultadoAnalise | undefined>('/analysis/latest', { signal }),
  execucoes: (signal?: AbortSignal) => requisicao<ExecucaoAnalise[]>('/analysis/runs', { signal }),
  rodarAnalise: () => requisicao<ExecucaoAnalise>('/analysis/run', { method: 'POST' }),
  resumo: (signal?: AbortSignal) => requisicao<ResumoDados>('/data/summary', { signal }),
  importar: (body: FormData) => requisicao<Importacao>('/data/import', { method: 'POST', body }),
  apagarDados: () => requisicao<void>('/data', { method: 'DELETE' }),
  imagens: (signal?: AbortSignal) => requisicao<ImagemAgua[]>('/images', { signal }),
  enviarImagem: (body: FormData) => requisicao<ImagemAgua>('/images', { method: 'POST', body }),
  confirmarImagem: (imagem: number, body: ConfirmacaoImagem) =>
    requisicao<ImagemAgua>(`/images/${id(imagem)}/confirm`, { method: 'POST', body }),
  apagarImagem: (imagem: number) => requisicao<void>(`/images/${id(imagem)}`, { method: 'DELETE' }),
  anotacoes: (estacao = '', signal?: AbortSignal) =>
    requisicao<Anotacao[]>(`/notes${estacao ? `?station=${id(estacao)}` : ''}`, { signal }),
  criarAnotacao: (body: NovaAnotacao) => requisicao<Anotacao>('/notes', { method: 'POST', body }),
  apagarAnotacao: (anotacao: number) =>
    requisicao<void>(`/notes/${id(anotacao)}`, { method: 'DELETE' }),
  statusAssistente: (signal?: AbortSignal) =>
    requisicao<StatusAssistente>('/assistant/status', { signal }),
  historico: (signal?: AbortSignal) => requisicao<MensagemChat[]>('/assistant/history', { signal }),
  perguntar: (question: string) =>
    requisicao<MensagemChat>('/assistant/ask', { method: 'POST', body: { question } }),
  limparHistorico: () => requisicao<void>('/assistant/history', { method: 'DELETE' }),
  usuarios: (signal?: AbortSignal) => requisicao<Usuario[]>('/users', { signal }),
  criarUsuario: (body: NovoUsuario) => requisicao<Usuario>('/users', { method: 'POST', body }),
  atualizarUsuario: (usuario: number, body: Partial<Pick<Usuario, 'role' | 'active' | 'name'>>) =>
    requisicao<Usuario>(`/users/${id(usuario)}`, { method: 'PATCH', body }),
  apagarUsuario: (usuario: number) =>
    requisicao<void>(`/users/${id(usuario)}`, { method: 'DELETE' }),
};
