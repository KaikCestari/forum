import type { FormEvent } from 'react';
import type { Papel } from '../../api/tipos';
import { api } from '../../api/recursos';
import { useAcao } from '../../api/useAcao';
import { Erro } from '../../components/Estados';
export function CriarUsuario({ aoCriar }: { aoCriar: () => void }) {
  const acao = useAcao();
  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulario = e.currentTarget;
    const campos = new FormData(formulario);
    const resultado = await acao.executar(() =>
      api.criarUsuario({
        name: String(campos.get('name')).trim(),
        email: String(campos.get('email')).trim(),
        password: String(campos.get('password')),
        role: campos.get('role') as Papel,
      }),
    );
    if (resultado) {
      formulario.reset();
      aoCriar();
    }
  }
  return (
    <details className="bloco formulario-expansivel">
      <summary>Criar usuário</summary>
      <Erro erro={acao.erro} />
      <form onSubmit={criar}>
        <fieldset disabled={acao.executando}>
          <div className="form-grid">
            <label>
              Nome
              <input name="name" autoComplete="off" required />
            </label>
            <label>
              Email
              <input name="email" type="email" autoComplete="off" required />
            </label>
            <label>
              Senha inicial
              <input name="password" type="password" autoComplete="new-password" required />
            </label>
            <label>
              Papel
              <select name="role" defaultValue="FUNCIONARIO">
                <option value="FUNCIONARIO">Funcionário</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </label>
          </div>
          <button className="botao" disabled={acao.executando}>
            {acao.executando ? 'Criando…' : 'Criar usuário'}
          </button>
        </fieldset>
      </form>
    </details>
  );
}
