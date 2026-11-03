// Limno: a IA especialista em ecossistemas aquáticos, num chat de coluna única (como o do Claude).
// Antes da primeira mensagem mostra uma saudação com o compositor no centro; depois, a conversa
// rola e o compositor fica preso embaixo. O painel "Contexto" mostra o que a Limno consulta.
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../../api/recursos';
import { useConsulta } from '../../api/useConsulta';
import { useAcao } from '../../api/useAcao';
import type { MensagemChat } from '../../api/tipos';
import { useAuth } from '../../auth/AuthContext';
import { Erro } from '../../components/Estados';
import { ConfirmarExclusao } from '../../components/ConfirmarExclusao';
import { SimboloRegua } from '../../components/Layout';
import { icones } from '../../components/Icones';
import { data, numero, percentual } from '../../components/formatacao';
import { GraficoResposta } from './GraficoResposta';
import { emBlocos, partesNegrito, separarGraficos } from './resposta';

const sugestoes = [
  'Qual estação está em pior situação e por quê?',
  'O oxigênio dissolvido está adequado para a vida aquática?',
  'Há sinais de eutrofização em algum ponto?',
  'Que coletas de campo você recomenda para esta semana?',
];

function saudacao(nome?: string) {
  const hora = new Date().getHours();
  const periodo = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiro = nome?.split(/\s+/)[0];
  return primeiro ? `${periodo}, ${primeiro}` : periodo;
}

export function Assistente() {
  const { usuario } = useAuth();
  const status = useConsulta(api.statusAssistente);
  const historico = useConsulta(api.historico);
  const analise = useConsulta(api.analise);
  const painel = useConsulta(api.painel);
  const acao = useAcao();
  const [pergunta, setPergunta] = useState('');
  const [enviada, setEnviada] = useState('');
  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const [contexto, setContexto] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const nomes = Object.fromEntries((analise.dados?.stations ?? []).map((s) => [s.stationId, s.name]));
  const disponivel = !!status.dados?.available;
  const vazia = !historico.carregando && !mensagens.length && !enviada;

  useEffect(() => {
    if (historico.dados) setMensagens(historico.dados);
  }, [historico.dados]);
  useEffect(() => {
    if (enviada || mensagens.length) fim.current?.scrollIntoView({ block: 'end' });
  }, [mensagens, enviada]);

  async function perguntar(texto: string) {
    if (!texto.trim() || acao.executando) return;
    setEnviada(texto.trim());
    setPergunta('');
    const resultado = await acao.executar(() => api.perguntar(texto.trim()));
    if (resultado) setMensagens((m) => [...m, resultado.valor]);
    else setPergunta(texto);
    setEnviada('');
  }
  async function limpar() {
    if (await acao.executar(api.limparHistorico)) {
      setMensagens([]);
      setContexto(false);
    }
  }

  const compositor = (
    <Compositor
      valor={pergunta}
      mudar={setPergunta}
      enviar={() => void perguntar(pergunta)}
      ocupado={acao.executando}
      disponivel={disponivel}
      foco={vazia}
    />
  );

  return (
    <div className="chat">
      <header className="chat-topo">
        <div className="chat-titulo">
          <h1>Limno</h1>
          <span className={`chat-status${disponivel ? ' pronta' : ''}`} role="status">
            <i aria-hidden="true" />
            {status.carregando ? 'Verificando…' : disponivel ? status.dados?.model : 'Fora do ar'}
          </span>
        </div>
        <button
          type="button"
          className={`chat-botao${contexto ? ' ativo' : ''}`}
          aria-expanded={contexto}
          aria-controls="chat-contexto"
          onClick={() => setContexto(!contexto)}
        >
          {icones.info({ tamanho: 16 })}
          Contexto
        </button>
      </header>

      <div className="chat-corpo">
        <div className="chat-rolagem">
          {vazia ? (
            <div className="chat-inicio">
              <SimboloRegua tamanho={44} />
              <h2>{saudacao(usuario?.name)}</h2>
              <p>
                Pergunte sobre as estações, os parâmetros ou um período. A Limno lê a última análise, as
                imagens confirmadas e as anotações de campo da equipe.
              </p>
              {compositor}
              <ul className="chat-sugestoes">
                {sugestoes.map((s) => (
                  <li key={s}>
                    <button type="button" disabled={!disponivel || acao.executando} onClick={() => void perguntar(s)}>
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
              {!status.carregando && !disponivel && (
                <p className="aviso">A Limno está fora do ar. Peça ao administrador para verificar o Ollama.</p>
              )}
            </div>
          ) : (
            <div className="chat-coluna" role="log" aria-live="polite" aria-label="Conversa com a Limno">
              {mensagens.map((m) => (
                <Troca key={m.id} mensagem={m} nomes={nomes} />
              ))}
              {enviada && (
                <div className="troca">
                  <p className="fala-pessoa">{enviada}</p>
                  <div className="fala-limno">
                    <span className="fala-avatar pensando">
                      <SimboloRegua tamanho={26} />
                    </span>
                    <p className="pensando-texto">Consultando os dados das estações…</p>
                  </div>
                </div>
              )}
              <div ref={fim} />
            </div>
          )}
        </div>

        {!vazia && (
          <div className="chat-rodape">
            <Erro erro={acao.erro} />
            {!status.carregando && !disponivel && (
              <p className="aviso">A Limno está fora do ar. Peça ao administrador para verificar o Ollama.</p>
            )}
            {compositor}
            <p className="chat-nota">A Limno pode errar. Confira as conclusões antes de decisões de campo.</p>
          </div>
        )}
        {vazia && acao.erro && (
          <div className="chat-rodape">
            <Erro erro={acao.erro} />
          </div>
        )}

        {contexto && (
          <aside id="chat-contexto" className="chat-contexto" aria-label="O que a Limno consulta">
            <div className="linha">
              <h2>O que a Limno consulta</h2>
              <button type="button" className="botao-icone escuro" aria-label="Fechar" onClick={() => setContexto(false)}>
                {icones.fechar({ tamanho: 16 })}
              </button>
            </div>
            {analise.dados ? (
              <dl className="limno-fontes">
                <dt>Análise de sensores</dt>
                <dd>
                  {analise.dados.stations.length} estações, de {data(analise.dados.period.start)} a{' '}
                  {data(analise.dados.period.end)}
                </dd>
                <dt>Alertas e dias fora do padrão</dt>
                <dd>
                  {numero(analise.dados.alerts.length, 0)} alertas e{' '}
                  {numero(analise.dados.anomalies.episodes.length, 0)} episódios
                </dd>
                <dt>Classificação da qualidade</dt>
                <dd>
                  {analise.dados.classification.accuracy != null
                    ? `${percentual(analise.dados.classification.accuracy)} de acerto`
                    : 'não executada'}
                </dd>
                <dt>Imagens confirmadas</dt>
                <dd>{numero(painel.dados?.imagesConfirmed, 0)}</dd>
              </dl>
            ) : (
              <p className="texto-apoio">
                Ainda não há análise de sensores. A Limno usa as imagens confirmadas e as anotações.
              </p>
            )}
            <p className="texto-apoio">
              Especialista em qualidade da água, IQA, CONAMA 357 e ecologia de rios, lagos e reservatórios. Ela
              não inventa medições: quando o dado não existe, avisa.
            </p>
            {mensagens.length > 0 && (
              <ConfirmarExclusao
                rotulo="Apagar minha conversa"
                descricao="Apagar todo o seu histórico com a Limno?"
                executar={limpar}
                ocupado={acao.executando}
              />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function Compositor({
  valor,
  mudar,
  enviar,
  ocupado,
  disponivel,
  foco,
}: {
  valor: string;
  mudar: (v: string) => void;
  enviar: () => void;
  ocupado: boolean;
  disponivel: boolean;
  foco: boolean;
}) {
  const campo = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const t = campo.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${Math.min(t.scrollHeight, 220)}px`;
  }, [valor]);
  useEffect(() => {
    if (foco) campo.current?.focus({ preventScroll: true });
  }, [foco]);

  function submeter(e: FormEvent) {
    e.preventDefault();
    enviar();
  }
  return (
    <form className="compositor" onSubmit={submeter}>
      <label className="sr-only" htmlFor="pergunta">
        Sua pergunta para a Limno
      </label>
      <textarea
        id="pergunta"
        ref={campo}
        value={valor}
        rows={1}
        onChange={(e) => mudar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            enviar();
          }
        }}
        placeholder="Pergunte à Limno sobre a água"
      />
      <div className="compositor-acoes">
        <span>Shift + Enter para nova linha</span>
        <button
          className="compositor-enviar"
          aria-label="Enviar pergunta"
          disabled={!disponivel || ocupado || !valor.trim()}
        >
          {ocupado ? <span className="indicador" aria-hidden="true" /> : icones.enviar({ tamanho: 18 })}
        </button>
      </div>
    </form>
  );
}

function Troca({ mensagem, nomes }: { mensagem: MensagemChat; nomes: Record<string, string> }) {
  const { texto, graficos } = separarGraficos(mensagem.answer);
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      /* área de transferência indisponível */
    }
  }
  return (
    <article className="troca">
      <p className="fala-pessoa">{mensagem.question}</p>
      <div className="fala-limno">
        <span className="fala-avatar">
          <SimboloRegua tamanho={26} />
        </span>
        <div className="fala-conteudo">
          {emBlocos(texto).map((b, i) =>
            b.tipo === 'lista' ? (
              <ul key={i}>
                {b.itens.map((item, j) => (
                  <li key={j}>
                    <Negrito texto={item} />
                  </li>
                ))}
              </ul>
            ) : (
              <p key={i}>
                <Negrito texto={b.texto} />
              </p>
            ),
          )}
          {graficos.length > 0 && (
            <div className="graficos-resposta">
              {graficos.map((g) => (
                <GraficoResposta
                  key={`${g.estacao}-${g.parametro}`}
                  pedido={g}
                  nomeEstacao={nomes[g.estacao] ?? g.estacao}
                />
              ))}
            </div>
          )}
          <div className="fala-acoes">
            <button type="button" onClick={() => void copiar()} aria-label="Copiar resposta" title="Copiar">
              {copiado ? icones.feito({ tamanho: 15 }) : icones.copiar({ tamanho: 15 })}
            </button>
            <small>{data(mensagem.createdAt)}</small>
          </div>
        </div>
      </div>
    </article>
  );
}

function Negrito({ texto }: { texto: string }) {
  return (
    <>
      {partesNegrito(texto).map((p, i) =>
        p.negrito ? <strong key={i}>{p.texto}</strong> : <span key={i}>{p.texto}</span>,
      )}
    </>
  );
}
