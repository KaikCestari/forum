import type { FormEvent } from 'react';
import { api } from '../../api/recursos';
import type { TipoEstacao } from '../../api/tipos';
import { useAcao } from '../../api/useAcao';
import { Erro } from '../../components/Estados';
import { tiposEstacao } from '../../components/formatacao';
export function CriarEstacao({ aoCriar }: { aoCriar: () => void }) {
  const acao = useAcao();
  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulario = e.currentTarget;
    const campos = new FormData(formulario);
    const resultado = await acao.executar(() =>
      api.criarEstacao({
        name: String(campos.get('name')).trim(),
        type: campos.get('type') as TipoEstacao,
        ...(campos.get('lat') ? { lat: Number(campos.get('lat')) } : {}),
        ...(campos.get('lon') ? { lon: Number(campos.get('lon')) } : {}),
      }),
    );
    if (resultado) {
      formulario.reset();
      aoCriar();
    }
  }
  return (
    <details className="bloco formulario-expansivel">
      <summary>Criar estação</summary>
      <Erro erro={acao.erro} />
      <form onSubmit={salvar}>
        <div className="form-grid">
          <label>
            Nome da estação
            <input name="name" required maxLength={150} />
          </label>
          <label>
            Tipo de ambiente
            <select name="type">
              {Object.entries(tiposEstacao).map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Latitude (opcional)
            <input name="lat" type="number" step="any" min="-90" max="90" />
          </label>
          <label>
            Longitude (opcional)
            <input name="lon" type="number" step="any" min="-180" max="180" />
          </label>
        </div>
        <button className="botao" disabled={acao.executando}>
          {acao.executando ? 'Criando…' : 'Criar estação'}
        </button>
      </form>
    </details>
  );
}
