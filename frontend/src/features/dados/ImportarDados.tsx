import { useState, type FormEvent } from 'react';
import { api } from '../../api/recursos';
import type { Importacao } from '../../api/tipos';
import { useAcao } from '../../api/useAcao';
import { Erro, Sucesso } from '../../components/Estados';
import { Espera } from '../../components/Espera';
import { numero } from '../../components/formatacao';
export function ImportarDados({
  aoImportar,
  aoOcupar,
  bloqueado,
}: {
  aoImportar: () => void;
  aoOcupar: (ocupado: boolean) => void;
  bloqueado: boolean;
}) {
  const acao = useAcao();
  const [resultado, setResultado] = useState<Importacao | null>(null);
  async function importar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulario = e.currentTarget;
    const campos = new FormData(formulario);
    for (const chave of ['stations', 'events']) {
      const arquivo = campos.get(chave);
      if (!(arquivo instanceof File) || !arquivo.size) campos.delete(chave);
    }
    if (!String(campos.get('name')).trim()) campos.delete('name');
    setResultado(null);
    aoOcupar(true);
    const resposta = await acao.executar(() => api.importar(campos));
    aoOcupar(false);
    if (resposta) {
      setResultado(resposta.valor);
      formulario.reset();
      aoImportar();
    }
  }
  return (
    <section className="bloco">
      <h2>Importar leituras de sensores</h2>
      <p>
        A importação também executa a análise. Um dia precisa de pelo menos seis leituras para
        entrar no processamento.
      </p>
      <Erro erro={acao.erro} />
      <form onSubmit={importar}>
        <fieldset disabled={acao.executando || bloqueado}>
          <label>
            Nome do conjunto de dados (opcional)
            <input name="name" placeholder="Ex.: Monitoramento da bacia — novembro" />
          </label>
          <div className="form-grid">
            <label>
              Leituras (CSV obrigatório)
              <input type="file" name="measurements" accept=".csv,text/csv" required />
            </label>
            <label>
              Estações (CSV opcional)
              <input type="file" name="stations" accept=".csv,text/csv" />
            </label>
            <label>
              Eventos conhecidos (CSV opcional)
              <input type="file" name="events" accept=".csv,text/csv" />
            </label>
          </div>
          <button className="botao" disabled={acao.executando || bloqueado}>
            {acao.executando ? 'Importando e analisando…' : 'Importar e analisar'}
          </button>
        </fieldset>
      </form>
      <details className="como-funciona">
        <summary>Sobre os arquivos</summary>
        <p>
          Associe as leituras às estações pelo identificador do ponto. Os eventos conhecidos ajudam
          a avaliar se a análise reconheceu alterações observadas em campo.
        </p>
        <p>
          Aguarde o resultado da importação para conferir os avisos sobre os arquivos e os dias
          aproveitados.
        </p>
      </details>
      {acao.executando && (
        <Espera texto="Importando os arquivos e executando a análise. Aguarde nesta página…" />
      )}
      {resultado && (
        <div className="resultado-importacao">
          <Sucesso>Dados importados: {resultado.name}.</Sucesso>
          <p>
            {numero(resultado.measurements, 0)} leituras, {numero(resultado.stations, 0)} estações,
            {numero(resultado.events, 0)} eventos e {numero(resultado.readingsPerDay)} leituras
            por dia
          </p>
          {resultado.warnings.length > 0 && (
            <div className="aviso">
              <h3>Avisos da importação</h3>
              <ul>
                {resultado.warnings.map((aviso, i) => (
                  <li key={i}>{aviso}</li>
                ))}
              </ul>
            </div>
          )}
          {resultado.analysis.status === 'FALHOU' ? (
            <Erro
              erro={
                resultado.analysis.error ||
                'Os dados foram importados, mas a análise não foi concluída. Tente executá-la novamente.'
              }
            />
          ) : (
            <p role="status">
              {resultado.analysis.status === 'CONCLUIDA'
                ? 'Análise concluída. Os resultados já estão disponíveis na área Análises.'
                : 'A análise está em andamento.'}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
