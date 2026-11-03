// Resume os dados reais do monitoramento e orienta o primeiro uso.
import { Link } from 'react-router';
import { api } from '../../api/recursos';
import { useConsulta } from '../../api/useConsulta';
import { useAuth } from '../../auth/AuthContext';
import { Carregando, Erro, Vazio } from '../../components/Estados';
import { Bloco, Pagina, ComoFunciona } from '../../components/Pagina';
import { ListaAlertas } from '../../components/ListaAlertas';
import { data, numero } from '../../components/formatacao';
export function Painel() {
  const consulta = useConsulta(api.painel);
  const estacoes = useConsulta(api.estacoes);
  const nomes = Object.fromEntries((estacoes.dados ?? []).map((e) => [e.id, e.name]));
  const { usuario } = useAuth();
  const painel = consulta.dados;
  return (
    <Pagina
      titulo="Um olhar sobre a água"
      descricao="Acompanhe as condições dos seus pontos de monitoramento."
      acoes={
        <Link className="botao" to="/imagens">
          Registrar imagem
        </Link>
      }
    >
      <Erro erro={consulta.erro} tentar={consulta.recarregar} />
      {consulta.carregando && <Carregando />}
      {painel && (
        <>
          <div className="faixa-periodo">
            <span>{painel.summary.datasetName || 'Seu observatório'}</span>
            <span>
              {painel.summary.firstReading
                ? `${data(painel.summary.firstReading)} a ${data(painel.summary.lastReading)}`
                : 'Aguardando leituras de sensores'}
            </span>
          </div>
          <div className="indicadores">
            <div>
              <span>IQA médio</span>
              <strong>{numero(painel.iqaMean)}</strong>
              <small>Qualidade da água · 0 a 100</small>
            </div>
            <div>
              <span>Estações em risco</span>
              <strong>{numero(painel.stationsAtRisk, 0)}</strong>
              <small>Precisam de acompanhamento</small>
            </div>
            <Link to="/imagens">
              <span>Imagens pendentes</span>
              <strong>{numero(painel.imagesPending, 0)}</strong>
              <small>Aguardam sua revisão</small>
            </Link>
            <div>
              <span>Imagens confirmadas</span>
              <strong>{numero(painel.imagesConfirmed, 0)}</strong>
              <small>Observações revisadas</small>
            </div>
          </div>
          {!painel.hasData && (
            <Vazio titulo="Seu monitoramento começa aqui">
              <p>
                Registre uma foto da água ou uma imagem de satélite e confira a leitura da IA. As
                observações confirmadas ficam disponíveis para sua equipe e para o assistente.
              </p>
              <p>
                O IQA e as análises de sensores aparecem após importar uma planilha com pelo menos
                seis leituras por dia.
              </p>
              <div className="acoes">
                <Link className="botao" to="/imagens">
                  Enviar primeira imagem
                </Link>
                {usuario?.role === 'ADMIN' ? (
                  <Link className="botao secundario" to="/dados">
                    Importar planilha
                  </Link>
                ) : (
                  <Link className="botao secundario" to="/estacoes">
                    Ver pontos de monitoramento
                  </Link>
                )}
              </div>
              {usuario?.role !== 'ADMIN' && (
                <p className="texto-apoio">
                  Peça ao administrador para cadastrar os pontos e importar as leituras.
                </p>
              )}
            </Vazio>
          )}
          <div className="duas-colunas">
            <Bloco titulo="Alertas recentes">
              <ListaAlertas alertas={painel.recentAlerts} nomes={nomes} />
              <Link className="link-texto" to="/analises">
                Ver todas as análises
              </Link>
            </Bloco>
            <Bloco titulo="O que os dados mostram">
              {painel.insights.length ? (
                <ul className="lista-insights">
                  {painel.insights.map((texto, i) => (
                    <li key={i}>{texto}</li>
                  ))}
                </ul>
              ) : (
                <p className="texto-apoio">
                  As principais observações aparecerão aqui após a primeira análise.
                </p>
              )}
              <ComoFunciona algoritmo="IQA CETESB/NSF">
                O Índice de Qualidade da Água reúne parâmetros em uma escala de 0 a 100. Quanto
                maior, melhor a qualidade: ótima a partir de 80, boa a partir de 52, regular a
                partir de 37, ruim a partir de 20 e péssima abaixo de 20.
              </ComoFunciona>
            </Bloco>
          </div>
          {painel.lastRun && (
            <p className="texto-apoio">
              Última execução: {data(painel.lastRun.startedAt)} ·{' '}
              {painel.lastRun.status === 'CONCLUIDA'
                ? 'Concluída'
                : painel.lastRun.status === 'FALHOU'
                  ? 'Não concluída'
                  : 'Em andamento'}
              {painel.lastRun.error && ` — ${painel.lastRun.error}`}
            </p>
          )}
        </>
      )}
    </Pagina>
  );
}
