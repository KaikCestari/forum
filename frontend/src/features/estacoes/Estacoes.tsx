// Lista pontos de monitoramento e suas condições mais recentes.
import { Link } from 'react-router';
import { api } from '../../api/recursos';
import { useConsulta } from '../../api/useConsulta';
import { useAuth } from '../../auth/AuthContext';
import { Carregando, Erro, Vazio } from '../../components/Estados';
import { Pagina, Selo } from '../../components/Pagina';
import { numero, tiposEstacao, data } from '../../components/formatacao';
import { CriarEstacao } from './CriarEstacao';
export function Estacoes() {
  const consulta = useConsulta(api.estacoes);
  const { usuario } = useAuth();
  return (
    <Pagina titulo="Estações" descricao="Cada ponto conta uma parte da história do ecossistema.">
      {usuario?.role === 'ADMIN' && <CriarEstacao aoCriar={consulta.recarregar} />}
      <Erro erro={consulta.erro} tentar={consulta.recarregar} />
      {consulta.carregando && <Carregando />}
      {consulta.dados?.length === 0 && (
        <Vazio titulo="Nenhuma estação cadastrada">
          <p>
            {usuario?.role === 'ADMIN'
              ? 'Crie uma estação acima ou importe uma planilha de estações na área Dados.'
              : 'Peça ao administrador para cadastrar os pontos de monitoramento da sua equipe.'}
          </p>
        </Vazio>
      )}
      <div className="grade-estacoes">
        {consulta.dados?.map((estacao) => (
          <article className="estacao bloco" key={estacao.id}>
            <div className="linha">
              <span className="texto-apoio">{tiposEstacao[estacao.type]}</span>
              <Selo tom={estacao.alertsRecent ? 'atencao' : 'neutro'}>
                {estacao.alertsRecent
                  ? `${estacao.alertsRecent} alerta(s)`
                  : 'Sem alertas recentes'}
              </Selo>
            </div>
            <h2>
              <Link to={`/estacoes/${encodeURIComponent(estacao.id)}`}>{estacao.name}</Link>
            </h2>
            <div className="iqa-estacao">
              <strong>{numero(estacao.latest?.iqa)}</strong>
              <div>
                IQA mais recente<span>{estacao.latest?.iqaClass ?? 'Aguardando análise'}</span>
              </div>
            </div>
            <p className="texto-apoio">
              {estacao.latest
                ? `Leitura de ${data(estacao.latest.date)}`
                : 'Ainda não há leituras analisadas.'}
            </p>
            {estacao.clusterLabel && <p>{estacao.clusterLabel}</p>}
            <Link className="link-texto" to={`/estacoes/${encodeURIComponent(estacao.id)}`}>
              Acompanhar estação
            </Link>
          </article>
        ))}
      </div>
    </Pagina>
  );
}
