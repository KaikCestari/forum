import type { FormEvent } from 'react';
import type { Estacao, TipoAnotacao } from '../../api/tipos';
import { api } from '../../api/recursos';
import { useAcao } from '../../api/useAcao';
import { Erro } from '../../components/Estados';
import { hoje } from '../../components/formatacao';
export const tiposAnotacao = { observacao: 'Observação', coleta: 'Coleta', evento: 'Evento' };
export function FormularioAnotacao({
  estacoes,
  aoSalvar,
}: {
  estacoes: Estacao[];
  aoSalvar: () => void;
}) {
  const acao = useAcao();
  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulario = e.currentTarget;
    const campos = new FormData(formulario);
    const resultado = await acao.executar(() =>
      api.criarAnotacao({
        stationId: String(campos.get('stationId')),
        notedOn: String(campos.get('notedOn')),
        kind: campos.get('kind') as TipoAnotacao,
        text: String(campos.get('text')).trim(),
      }),
    );
    if (resultado) {
      formulario.reset();
      aoSalvar();
    }
  }
  return (
    <section className="bloco">
      <h2>Nova anotação</h2>
      <Erro erro={acao.erro} />
      <form onSubmit={salvar}>
        <fieldset disabled={acao.executando || !estacoes.length}>
          <div className="form-grid">
            <label>
              Estação
              <select name="stationId" required defaultValue="">
                <option value="" disabled>
                  Selecione uma estação
                </option>
                {estacoes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Data
              <input name="notedOn" type="date" defaultValue={hoje()} required />
            </label>
            <label>
              Tipo de registro
              <select name="kind">
                {Object.entries(tiposAnotacao).map(([v, n]) => (
                  <option value={v} key={v}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            O que você observou?
            <textarea
              name="text"
              rows={4}
              required
              placeholder="Descreva as condições locais, a coleta ou o evento observado."
            />
          </label>
          <button className="botao" disabled={acao.executando || !estacoes.length}>
            {acao.executando ? 'Salvando…' : 'Salvar anotação'}
          </button>
        </fieldset>
      </form>
      {!estacoes.length && (
        <p className="aviso">
          Cadastre uma estação ou peça ao administrador antes de registrar uma anotação.
        </p>
      )}
    </section>
  );
}
