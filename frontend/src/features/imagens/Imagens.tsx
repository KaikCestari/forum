// Integra envio, filtro por estado e revisão das imagens de monitoramento.
import { useState } from 'react';
import { api } from '../../api/recursos';
import { useConsulta } from '../../api/useConsulta';
import { Carregando, Erro, Sucesso, Vazio } from '../../components/Estados';
import { Pagina } from '../../components/Pagina';
import { EnviarImagem } from './EnviarImagem';
import { CartaoImagem } from './CartaoImagem';
export function Imagens() {
  const consulta = useConsulta(api.imagens);
  const estacoes = useConsulta(api.estacoes);
  const [filtro, setFiltro] = useState('');
  const [aviso, setAviso] = useState('');
  const imagens = consulta.dados?.filter((i) => !filtro || i.status === filtro);
  return (
    <Pagina titulo="Imagens" descricao="Observe, confira e registre o que acontece na água.">
      <Erro erro={estacoes.erro} tentar={estacoes.recarregar} />
      {estacoes.carregando && <Carregando texto="Carregando pontos de monitoramento…" />}
      {estacoes.dados && (
        <EnviarImagem
          estacoes={estacoes.dados}
          aoEnviar={(imagem) => {
            setAviso(
              imagem.status === 'ERRO_ANALISE'
                ? 'Imagem recebida. A leitura automática falhou; revise manualmente o registro abaixo.'
                : 'Imagem recebida. Revise a leitura abaixo antes de confirmar.',
            );
            setFiltro('');
            consulta.recarregar();
            estacoes.recarregar();
          }}
        />
      )}
      {aviso && <Sucesso>{aviso}</Sucesso>}
      <div className="cabecalho-lista">
        <h2>Registros da equipe</h2>
        <label>
          Status
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todos os registros</option>
            <option value="PENDENTE">Aguardando revisão</option>
            <option value="CONFIRMADA">Confirmadas</option>
            <option value="ERRO_ANALISE">Falha na leitura</option>
          </select>
        </label>
      </div>
      <Erro erro={consulta.erro} tentar={consulta.recarregar} />
      {consulta.carregando && <Carregando />}
      {imagens?.length === 0 && (
        <Vazio
          titulo={
            filtro
              ? 'Nenhuma imagem com este status'
              : 'Sua primeira observação pode ser uma imagem'
          }
        >
          <p>
            {filtro
              ? 'Escolha outro status para ver os demais registros.'
              : 'Use o formulário acima para enviar uma foto ou imagem de satélite.'}
          </p>
        </Vazio>
      )}
      {imagens?.map((imagem) => (
        <CartaoImagem key={imagem.id} imagem={imagem} atualizar={consulta.recarregar} />
      ))}
    </Pagina>
  );
}
