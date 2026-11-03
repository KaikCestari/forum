import { useState, type FormEvent } from 'react';
import type { Papel, Usuario } from '../../api/tipos';
import { api } from '../../api/recursos';
import { useAcao } from '../../api/useAcao';
import { useAuth } from '../../auth/AuthContext';
import { Erro } from '../../components/Estados';
import { Selo } from '../../components/Pagina';
import { ConfirmarExclusao } from '../../components/ConfirmarExclusao';
import { nomePapel } from '../../components/formatacao';
export function CartaoUsuario({ pessoa, atualizar }: { pessoa: Usuario; atualizar: () => void }) {
  const auth = useAuth();
  const acao = useAcao();
  const [editando, setEditando] = useState(false);
  const proprio = auth.usuario?.id === pessoa.id;
  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const campos = new FormData(e.currentTarget);
    const resultado = await acao.executar(() =>
      api.atualizarUsuario(pessoa.id, {
        name: String(campos.get('name')).trim(),
        role: campos.get('role') as Papel,
        active: campos.get('active') === 'true',
      }),
    );
    if (resultado) {
      setEditando(false);
      atualizar();
      if (proprio) auth.tentar();
    }
  }
  async function apagar() {
    if (await acao.executar(() => api.apagarUsuario(pessoa.id))) atualizar();
  }
  return (
    <article className="bloco usuario">
      <div className="linha">
        <div>
          <h2>
            {pessoa.name}
            {proprio && ' (você)'}
          </h2>
          <p>{pessoa.email}</p>
        </div>
        <div className="acoes">
          <Selo>{nomePapel[pessoa.role]}</Selo>
          <Selo tom={pessoa.active ? 'bom' : 'neutro'}>
            {pessoa.active ? 'Ativo' : 'Desativado'}
          </Selo>
        </div>
      </div>
      <Erro erro={acao.erro} />
      {editando ? (
        <form onSubmit={salvar}>
          <fieldset disabled={acao.executando}>
            <div className="form-grid">
              <label>
                Nome
                <input name="name" defaultValue={pessoa.name} required />
              </label>
              <label>
                Papel
                <select name="role" defaultValue={pessoa.role}>
                  <option value="FUNCIONARIO">Funcionário</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </label>
              <label>
                Situação
                <select name="active" defaultValue={String(pessoa.active)}>
                  <option value="true">Ativo</option>
                  <option value="false">Desativado</option>
                </select>
              </label>
            </div>
            {proprio && (
              <p className="aviso">
                Alterações no seu papel ou situação podem encerrar seu acesso à administração.
              </p>
            )}
            <div className="acoes">
              <button className="botao" disabled={acao.executando}>
                {acao.executando ? 'Salvando…' : 'Salvar alterações'}
              </button>
              <button className="botao secundario" type="button" onClick={() => setEditando(false)}>
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      ) : (
        <div className="acoes">
          <button className="botao secundario" onClick={() => setEditando(true)}>
            Editar usuário
          </button>
          {!proprio && (
            <ConfirmarExclusao
              descricao={`Apagar a conta de ${pessoa.name}?`}
              executar={apagar}
              ocupado={acao.executando}
            />
          )}
        </div>
      )}
    </article>
  );
}
