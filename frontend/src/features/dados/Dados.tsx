// Reúne resumo, importação, execução manual e exclusão de dados para administradores.
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api/recursos';
import { useConsulta } from '../../api/useConsulta';
import { useAcao } from '../../api/useAcao';
import { Bloco, Pagina, Selo } from '../../components/Pagina';
import { Carregando, Erro, Sucesso, Vazio } from '../../components/Estados';
import { ConfirmarExclusao } from '../../components/ConfirmarExclusao';
import { Espera } from '../../components/Espera';
import { data, numero, percentual } from '../../components/formatacao';
import { ImportarDados } from './ImportarDados';
export function Dados() {
  const resumo = useConsulta(api.resumo);
  const execucoes = useConsulta(api.execucoes);
  const acao = useAcao();
  const [mensagem, setMensagem] = useState('');
  const [falha, setFalha] = useState('');
  const [operacao, setOperacao] = useState('');
  const [importando, setImportando] = useState(false);
  const atualizar = () => {
    resumo.recarregar();
    execucoes.recarregar();
  };
  async function analisar() {
    setMensagem('');
    setFalha('');
    setOperacao('Analisando os dados. Aguarde nesta página…');
    const resultado = await acao.executar(api.rodarAnalise);
    if (resultado) {
      if (resultado.valor.status === 'FALHOU')
        setFalha(resultado.valor.error || 'A análise não foi concluída.');
      else
        setMensagem(
          resultado.valor.status === 'CONCLUIDA'
            ? 'Análise concluída. Consulte os resultados na área Análises.'
            : 'Análise em andamento. Atualize o histórico para acompanhar.',
        );
      atualizar();
    }
  }
  async function apagar() {
    setMensagem('');
    setFalha('');
    setOperacao('Apagando leituras, eventos e análises…');
    if (await acao.executar(api.apagarDados)) {
      setMensagem('Leituras, eventos e análises apagados.');
      atualizar();
    }
  }
  return (
    <Pagina
      titulo="Dados"
      descricao="Gerencie as leituras e o processamento do monitoramento."
      acoes={
        <Link className="botao secundario" to="/analises">
          Ver análises
        </Link>
      }
    >
      <Erro erro={resumo.erro} tentar={resumo.recarregar} />
      {resumo.carregando && <Carregando />}
      {resumo.dados && (
        <div className="resumo-dados">
          <h2>{resumo.dados.datasetName || 'Nenhum conjunto importado'}</h2>
          <dl className="medidas">
            <div>
              <dt>Estações</dt>
              <dd>{numero(resumo.dados.stations, 0)}</dd>
            </div>
            <div>
              <dt>Leituras</dt>
              <dd>{numero(resumo.dados.measurements, 0)}</dd>
            </div>
            <div>
              <dt>Período</dt>
              <dd>
                {data(resumo.dados.firstReading)} a {data(resumo.dados.lastReading)}
              </dd>
            </div>
            <div>
              <dt>Importado em</dt>
              <dd>{data(resumo.dados.importedAt)}</dd>
            </div>
          </dl>
        </div>
      )}
      <ImportarDados aoImportar={atualizar} aoOcupar={setImportando} bloqueado={acao.executando} />
      <Bloco titulo="Processamento">
        <p>Execute novamente a análise das leituras já importadas.</p>
        <Erro erro={acao.erro || falha} />
        {mensagem && <Sucesso>{mensagem}</Sucesso>}
        <button
          className="botao"
          disabled={acao.executando || importando || !resumo.dados?.measurements}
          onClick={analisar}
        >
          Rodar análise
        </button>
        {acao.executando && <Espera texto={operacao} />}
        <div className="cabecalho-lista">
          <h3>Últimas execuções</h3>
          <button
            className="botao secundario pequeno"
            disabled={execucoes.carregando}
            onClick={execucoes.recarregar}
          >
            Atualizar histórico
          </button>
        </div>
        <Erro erro={execucoes.erro} tentar={execucoes.recarregar} />
        {execucoes.carregando && <Carregando />}
        {execucoes.dados?.length === 0 && (
          <Vazio titulo="Nenhuma execução registrada">
            <p>Importe as primeiras leituras para iniciar o processamento.</p>
          </Vazio>
        )}
        {!!execucoes.dados?.length && (
          <div className="tabela-rolagem">
            <table>
              <caption>Histórico de análises</caption>
              <thead>
                <tr>
                  <th>Início</th>
                  <th>Status</th>
                  <th>IQA médio</th>
                  <th>Alertas</th>
                  <th>Acurácia</th>
                  <th>Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {execucoes.dados.map((execucao) => (
                  <tr key={execucao.id}>
                    <td>{data(execucao.startedAt)}</td>
                    <td>
                      <Selo
                        tom={
                          execucao.status === 'FALHOU'
                            ? 'critico'
                            : execucao.status === 'CONCLUIDA'
                              ? 'bom'
                              : 'neutro'
                        }
                      >
                        {execucao.status === 'CONCLUIDA'
                          ? 'Concluída'
                          : execucao.status === 'FALHOU'
                            ? 'Falhou'
                            : 'Em andamento'}
                      </Selo>
                    </td>
                    <td>{numero(execucao.iqaMean)}</td>
                    <td>{numero(execucao.alertCount, 0)}</td>
                    <td>{percentual(execucao.accuracy)}</td>
                    <td>{execucao.error || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloco>
      <section className="bloco zona-exclusao">
        <h2>Apagar dados de sensores</h2>
        <p>
          Remove todas as leituras, os eventos e os resultados de análises. As estações, imagens e
          anotações não fazem parte desta exclusão.
        </p>
        <ConfirmarExclusao
          rotulo="Apagar dados"
          descricao="Apagar todas as leituras, eventos e análises?"
          executar={apagar}
          ocupado={acao.executando || importando}
        />
      </section>
    </Pagina>
  );
}
