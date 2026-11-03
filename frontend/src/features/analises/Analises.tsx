import { Link } from 'react-router';
import { api } from '../../api/recursos';
import { useConsulta } from '../../api/useConsulta';
import { useAuth } from '../../auth/AuthContext';
import { Carregando, Erro, Vazio } from '../../components/Estados';
import { Pagina } from '../../components/Pagina';
import { data, numero } from '../../components/formatacao';
import { ExplorarAnalise } from './ExplorarAnalise';
export function Analises() {
  const consulta = useConsulta(api.analise);
  const { usuario } = useAuth();
  const analise = consulta.dados;
  return (
    <Pagina
      titulo="Análises"
      descricao="Entenda o que mudou, o que se parece e o que merece atenção."
    >
      <Erro erro={consulta.erro} tentar={consulta.recarregar} />
      {consulta.carregando && <Carregando texto="Carregando a última análise concluída…" />}
      {!consulta.carregando && !consulta.erro && !analise && (
        <Vazio titulo="As análises começam com as leituras">
          <p>
            Importe uma planilha de sensores com pelo menos seis leituras por dia. O sistema calcula
            a qualidade da água e procura mudanças no período.
          </p>
          {usuario?.role === 'ADMIN' ? (
            <Link className="botao" to="/dados">
              Ir para Dados
            </Link>
          ) : (
            <p>Peça ao administrador para importar as leituras e executar a análise.</p>
          )}
        </Vazio>
      )}
      {analise && (
        <>
          <div className="faixa-periodo">
            <span>
              {data(analise.period.start)} a {data(analise.period.end)}
            </span>
            <span>Gerada em {data(analise.generatedAt)}</span>
          </div>
          <p className="texto-apoio">
            {numero(analise.processing.validReadings, 0)} de{' '}
            {numero(analise.processing.rawReadings, 0)} leituras válidas ·{' '}
            {numero(analise.processing.days, 0)} dias analisados ·{' '}
            {numero(analise.processing.discardedDays, 0)} dias descartados
          </p>
          <ExplorarAnalise analise={analise} />
        </>
      )}
    </Pagina>
  );
}
