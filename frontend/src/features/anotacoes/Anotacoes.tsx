// Consulta registros de campo por estação e permite excluir registros autorizados.
import { useCallback, useState } from 'react';
import { api } from '../../api/recursos';
import { useConsulta } from '../../api/useConsulta';
import { useAcao } from '../../api/useAcao';
import { useAuth } from '../../auth/AuthContext';
import { Carregando, Erro, Sucesso, Vazio } from '../../components/Estados';
import { Pagina, Selo } from '../../components/Pagina';
import { ConfirmarExclusao } from '../../components/ConfirmarExclusao';
import { data } from '../../components/formatacao';
import { FormularioAnotacao, tiposAnotacao } from './FormularioAnotacao';
export function Anotacoes() {
  const [estacao, setEstacao] = useState('');
  const [salvo, setSalvo] = useState(false);
  const carregar = useCallback((signal: AbortSignal) => api.anotacoes(estacao, signal), [estacao]);
  const consulta = useConsulta(carregar);
  const estacoes = useConsulta(api.estacoes);
  const acao = useAcao();
  const { usuario } = useAuth();
  async function apagar(id: number) {
    if (await acao.executar(() => api.apagarAnotacao(id))) {
      setSalvo(false);
      consulta.recarregar();
    }
  }
  return (
    <Pagina
      titulo="Anotações de campo"
      descricao="O contexto que só quem está em campo consegue registrar."
    >
      <Erro erro={estacoes.erro} tentar={estacoes.recarregar} />
      {estacoes.carregando && <Carregando texto="Carregando estações…" />}
      {estacoes.dados && (
        <FormularioAnotacao
          estacoes={estacoes.dados}
          aoSalvar={() => {
            setSalvo(true);
            consulta.recarregar();
          }}
        />
      )}
      {salvo && <Sucesso>Anotação salva.</Sucesso>}
      <div className="cabecalho-lista">
        <h2>Caderno da equipe</h2>
        <label>
          Filtrar por estação
          <select value={estacao} onChange={(e) => setEstacao(e.target.value)}>
            <option value="">Todas as estações</option>
            {estacoes.dados?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Erro erro={consulta.erro} tentar={consulta.recarregar} />
      <Erro erro={acao.erro} />
      {consulta.carregando && <Carregando />}
      {consulta.dados?.length === 0 && (
        <Vazio titulo="Nenhuma anotação neste caderno">
          <p>Registre uma observação, coleta ou evento no formulário acima.</p>
        </Vazio>
      )}
      {consulta.dados?.map((nota) => (
        <article className="bloco anotacao" key={nota.id}>
          <div className="linha">
            <h2>{nota.stationName}</h2>
            <Selo>{tiposAnotacao[nota.kind]}</Selo>
          </div>
          <p className="texto-apoio">
            {data(nota.notedOn)} · {nota.author}
          </p>
          <p className="texto-preservado">{nota.text}</p>
          {(usuario?.role === 'ADMIN' || usuario?.name === nota.author) && (
            <ConfirmarExclusao
              descricao="Apagar esta anotação?"
              ocupado={acao.executando}
              executar={() => apagar(nota.id)}
            />
          )}
        </article>
      ))}
    </Pagina>
  );
}
