// Limno: a IA especialista em ecossistemas aquáticos. Mostra o que ela consulta, sugere perguntas
// e transforma os marcadores de gráfico das respostas em gráficos das estações.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../../api/recursos';
import { useConsulta } from '../../api/useConsulta';
import { useAcao } from '../../api/useAcao';
import type { MensagemChat } from '../../api/tipos';
import { Erro } from '../../components/Estados';
import { ConfirmarExclusao } from '../../components/ConfirmarExclusao';
import { SimboloRegua } from '../../components/Layout';
import { data, numero, percentual } from '../../components/formatacao';
import { GraficoResposta } from './GraficoResposta';
import { emBlocos, partesNegrito, separarGraficos } from './resposta';

const sugestoes = [
  'Qual estação está em pior situação e por quê?',
  'O oxigênio dissolvido está adequado para a vida aquática em todos os pontos?',
  'Há sinais de eutrofização em algum ponto?',
  'O que explica os dias fora do padrão mais recentes?',
  'Que coletas de campo você recomenda para esta semana?',
];

export function Assistente() {
  const status = useConsulta(api.statusAssistente);
  const historico = useConsulta(api.historico);
  const analise = useConsulta(api.analise);
  const painel = useConsulta(api.painel);
  const acao = useAcao();
  const [pergunta, setPergunta] = useState('');
  const [enviada, setEnviada] = useState('');
  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const fim = useRef<HTMLDivElement>(null);
  const nomes = Object.fromEntries((analise.dados?.stations ?? []).map((s) => [s.stationId, s.name]));
  const disponivel = !!status.dados?.available;

  useEffect(() => {
    if (historico.dados) setMensagens(historico.dados);
  }, [historico.dados]);
  useEffect(() => {
    if (enviada || mensagens.length) fim.current?.scrollIntoView({ block: 'nearest' });
  }, [mensagens, enviada]);

  async function perguntar(texto: string) {
    if (!texto.trim() || acao.executando) return;
    setEnviada(texto.trim());
    const resultado = await acao.executar(() => api.perguntar(texto.trim()));
    if (resultado) {
      setMensagens((m) => [...m, resultado.valor]);
      setPergunta('');
    }
    setEnviada('');
  }
  function enviar(e: FormEvent) {
    e.preventDefault();
    void perguntar(pergunta);
  }
  async function limpar() {
    if (await acao.executar(api.limparHistorico)) setMensagens([]);
  }

  return (
    <div className="limno">
      <header className="limno-cabecalho">
        <span className="limno-simbolo">
          <SimboloRegua tamanho={40} />
        </span>
        <div>
          <h1>Limno</h1>
          <p>IA especialista em ecossistemas aquáticos: qualidade da água, IQA, CONAMA 357 e ecologia de rios, lagos e reservatórios.</p>
        </div>
        <p className={`limno-status ${disponivel ? 'pronta' : ''}`} role="status">
          {status.carregando ? 'Verificando…' : disponivel ? 'Pronta' : 'Fora do ar'}
          {status.dados && <small>modelo {status.dados.model}</small>}
        </p>
      </header>

      <div className="limno-grade">
        <section className="limno-conversa" aria-label="Conversa com a Limno">
          <div className="conversa" role="log" aria-live="polite">
            {!historico.carregando && !mensagens.length && !enviada && (
              <div className="limno-boas-vindas">
                <p>
                  Eu leio a última análise do AquaML, as imagens confirmadas e as anotações de campo da
                  equipe, e respondo com os números e os gráficos das estações.
                </p>
                <p>Escolha uma pergunta para começar ou escreva a sua.</p>
              </div>
            )}
            {mensagens.map((m) => (
              <Troca key={m.id} mensagem={m} nomes={nomes} />
            ))}
            {enviada && (
              <div className="troca">
                <p className="fala-pessoa">{enviada}</p>
                <p className="fala-limno pensando">A Limno está consultando os dados das estações…</p>
              </div>
            )}
            <div ref={fim} />
          </div>
          <Erro erro={acao.erro} />
          {!status.carregando && !disponivel && (
            <p className="aviso">A Limno está fora do ar. Peça ao administrador para verificar o Ollama.</p>
          )}
          <form className="limno-compositor" onSubmit={enviar}>
            <label className="sr-only" htmlFor="pergunta">
              Sua pergunta para a Limno
            </label>
            <textarea
              id="pergunta"
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void perguntar(pergunta);
                }
              }}
              rows={2}
              disabled={acao.executando}
              placeholder="Pergunte sobre uma estação, um parâmetro ou um período"
            />
            <button className="botao" disabled={!disponivel || acao.executando || !pergunta.trim()}>
              Perguntar
            </button>
          </form>
        </section>

        <aside className="limno-lateral">
          <section>
            <h2>O que a Limno consulta</h2>
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
          </section>
          <section>
            <h2>Perguntas que ela responde bem</h2>
            <ul className="limno-sugestoes">
              {sugestoes.map((s) => (
                <li key={s}>
                  <button type="button" disabled={!disponivel || acao.executando} onClick={() => void perguntar(s)}>
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <p className="texto-apoio">
            A Limno não inventa medições: quando o dado não existe, ela avisa. Confira as conclusões antes
            de decisões de campo.
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
      </div>
    </div>
  );
}

function Troca({ mensagem, nomes }: { mensagem: MensagemChat; nomes: Record<string, string> }) {
  const { texto, graficos } = separarGraficos(mensagem.answer);
  return (
    <article className="troca">
      <p className="fala-pessoa">{mensagem.question}</p>
      <div className="fala-limno">
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
              <GraficoResposta key={`${g.estacao}-${g.parametro}`} pedido={g} nomeEstacao={nomes[g.estacao] ?? g.estacao} />
            ))}
          </div>
        )}
        <small>{data(mensagem.createdAt)}</small>
      </div>
    </article>
  );
}

function Negrito({ texto }: { texto: string }) {
  return (
    <>
      {partesNegrito(texto).map((p, i) => (p.negrito ? <strong key={i}>{p.texto}</strong> : <span key={i}>{p.texto}</span>))}
    </>
  );
}
