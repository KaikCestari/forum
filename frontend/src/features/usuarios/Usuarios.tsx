import { useState } from 'react';
import { api } from '../../api/recursos';
import { useConsulta } from '../../api/useConsulta';
import { Carregando, Erro, Sucesso, Vazio } from '../../components/Estados';
import { Pagina } from '../../components/Pagina';
import { CriarUsuario } from './CriarUsuario';
import { CartaoUsuario } from './CartaoUsuario';
export function Usuarios() {
  const consulta = useConsulta(api.usuarios);
  const [criado, setCriado] = useState(false);
  return (
    <Pagina titulo="Usuários" descricao="Organize o acesso da equipe ao observatório.">
      <CriarUsuario
        aoCriar={() => {
          setCriado(true);
          consulta.recarregar();
        }}
      />
      {criado && <Sucesso>Usuário criado. A conta já pode acessar o sistema.</Sucesso>}
      <Erro erro={consulta.erro} tentar={consulta.recarregar} />
      {consulta.carregando && <Carregando />}
      {consulta.dados?.length === 0 && (
        <Vazio titulo="Nenhum usuário encontrado">
          <p>Crie uma conta no formulário acima.</p>
        </Vazio>
      )}
      {consulta.dados?.map((pessoa) => (
        <CartaoUsuario key={pessoa.id} pessoa={pessoa} atualizar={consulta.recarregar} />
      ))}
    </Pagina>
  );
}
