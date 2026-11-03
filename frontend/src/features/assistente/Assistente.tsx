// Mantém o chat do usuário e mostra a disponibilidade do modelo fixo configurado no servidor.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../../api/recursos';
import { useConsulta } from '../../api/useConsulta';
import { useAcao } from '../../api/useAcao';
import { Carregando, Erro, Vazio } from '../../components/Estados';
import { Espera } from '../../components/Espera';
import { Pagina, Selo } from '../../components/Pagina';
import { ConfirmarExclusao } from '../../components/ConfirmarExclusao';
import { data } from '../../components/formatacao';
import type { MensagemChat } from '../../api/tipos';
export function Assistente() {
  const status = useConsulta(api.statusAssistente);
  const historico = useConsulta(api.historico);
  const acao = useAcao();
  const [pergunta, setPergunta] = useState('');
  const [enviada, setEnviada] = useState('');
  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (historico.dados) setMensagens(historico.dados);
  }, [historico.dados]);
  useEffect(() => {
    if (enviada || mensagens.length) fim.current?.scrollIntoView({ block: 'nearest' });
  }, [mensagens, enviada]);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    const texto = pergunta.trim();
    if (!texto) return;
    setEnviada(texto);
    const resultado = await acao.executar(() => api.perguntar(texto));
    if (resultado) {
      setMensagens((m) => [...m, resultado.valor]);
      setPergunta('');
    }
    setEnviada('');
    status.recarregar();
  }
  async function limpar() {
    if (await acao.executar(api.limparHistorico)) {
      setMensagens([]);
      historico.recarregar();
    }
  }
  return (
    <Pagina
      titulo="Assistente"
      descricao="Converse sobre os dados e as observações do seu monitoramento."
    >
      <section className="status-assistente">
        <div>
          <h2>Assistente ambiental</h2>
          {status.dados && (
            <>
              <Selo tom={status.dados.available ? 'bom' : 'atencao'}>
                {status.dados.available ? 'Disponível' : 'Indisponível'}
              </Selo>
              <p className="texto-apoio">Modelo: {status.dados.model}</p>
            </>
          )}
        </div>
        <button
          className="botao secundario"
          disabled={status.carregando}
          onClick={status.recarregar}
        >
          Verificar disponibilidade
        </button>
      </section>
      <Erro erro={status.erro} tentar={status.recarregar} />
      {status.carregando && <Carregando texto="Verificando o assistente…" />}
      {status.dados && !status.dados.available && (
        <p className="aviso">
          O assistente está indisponível. Tente novamente mais tarde ou peça ao administrador para
          verificar o serviço.
        </p>
      )}
      <p className="texto-apoio">
        As respostas consideram a última análise, as imagens confirmadas e as anotações de campo.
        Confira as conclusões antes de tomar decisões.
      </p>
      <Erro erro={historico.erro} tentar={historico.recarregar} />
      {historico.carregando && <Carregando texto="Carregando suas conversas…" />}
      <div
        className="conversa"
        role="log"
        aria-label="Conversa com o assistente"
        aria-live="polite"
      >
        {!historico.carregando && !historico.erro && !mensagens.length && !enviada && (
          <Vazio titulo="O que você gostaria de entender?">
            <p>
              Pergunte, por exemplo: “Quais estações precisam de mais atenção?” ou “O que mudou na
              qualidade da água?”
            </p>
          </Vazio>
        )}
        {mensagens.map((m) => (
          <article className="troca-chat" key={m.id}>
            <div className="pergunta">
              <strong>Você</strong>
              <p className="texto-preservado">{m.question}</p>
            </div>
            <div className="resposta">
              <strong>AquaML</strong>
              <p className="texto-preservado">{m.answer}</p>
              <small>
                {data(m.createdAt)} · {m.model}
              </small>
            </div>
          </article>
        ))}
        {enviada && (
          <div className="pergunta">
            <strong>Você</strong>
            <p>{enviada}</p>
          </div>
        )}
        <div ref={fim} />
      </div>
      <Erro erro={acao.erro} />
      {enviada && <Espera texto="O assistente está preparando a resposta…" />}
      <form className="compositor" onSubmit={enviar}>
        <label>
          Sua pergunta
          <textarea
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            rows={3}
            required
            disabled={acao.executando}
            placeholder="Escreva sua pergunta sobre o monitoramento"
          />
        </label>
        <div className="acoes">
          <button
            className="botao"
            disabled={
              !status.dados?.available ||
              status.carregando ||
              historico.carregando ||
              !!historico.erro ||
              acao.executando ||
              !pergunta.trim()
            }
          >
            {enviada ? 'Aguardando resposta…' : 'Enviar pergunta'}
          </button>
          {mensagens.length > 0 && (
            <ConfirmarExclusao
              rotulo="Limpar minha conversa"
              descricao="Apagar todo o seu histórico de conversa?"
              executar={limpar}
              ocupado={acao.executando}
            />
          )}
        </div>
      </form>
    </Pagina>
  );
}
