import { useState } from 'react';
import type { ImagemAgua } from '../../api/tipos';
import { api } from '../../api/recursos';
import { urlImagem } from '../../api/cliente';
import { useAcao } from '../../api/useAcao';
import { useAuth } from '../../auth/AuthContext';
import { ConfirmarExclusao } from '../../components/ConfirmarExclusao';
import { Erro } from '../../components/Estados';
import { Selo } from '../../components/Pagina';
import { data } from '../../components/formatacao';
import { RevisarImagem } from './RevisarImagem';
export function CartaoImagem({ imagem, atualizar }: { imagem: ImagemAgua; atualizar: () => void }) {
  const { usuario } = useAuth();
  const acao = useAcao();
  const [revisando, setRevisando] = useState(false);
  const [erroFoto, setErroFoto] = useState(false);
  const podeApagar = usuario?.role === 'ADMIN' || usuario?.name === imagem.uploadedBy;
  async function apagar() {
    if (await acao.executar(() => api.apagarImagem(imagem.id))) atualizar();
  }
  return (
    <article className="bloco cartao-imagem">
      <div className="imagem-resumo">
        <div className="foto">
          {erroFoto ? (
            <p>Não foi possível carregar a imagem.</p>
          ) : (
            <img
              src={urlImagem(imagem.fileUrl)}
              alt={`${imagem.kind === 'foto' ? 'Foto da água' : 'Imagem de satélite'} em ${imagem.stationName}, ${data(imagem.observedOn)}`}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setErroFoto(true)}
            />
          )}
        </div>
        <div>
          <div className="linha">
            <h2>{imagem.stationName}</h2>
            <Selo tom={imagem.status === 'CONFIRMADA' ? 'bom' : 'atencao'}>
              {imagem.status === 'CONFIRMADA'
                ? 'Confirmada'
                : imagem.status === 'ERRO_ANALISE'
                  ? 'Falha na leitura'
                  : 'Aguardando revisão'}
            </Selo>
          </div>
          <p>
            {imagem.kind === 'foto' ? 'Foto da água' : 'Imagem de satélite'} ·{' '}
            {data(imagem.observedOn)}
          </p>
          <p className="texto-apoio">
            Enviada por {imagem.uploadedBy} em {data(imagem.uploadedAt)}
          </p>
          {imagem.vision && <p>{imagem.vision.summary}</p>}
          {imagem.analysisError && <p className="aviso">{imagem.analysisError}</p>}
          <Erro erro={acao.erro} />
          <div className="acoes">
            {imagem.status !== 'CONFIRMADA' && !revisando && (
              <button className="botao" onClick={() => setRevisando(true)}>
                Revisar leitura
              </button>
            )}
            {podeApagar && (
              <ConfirmarExclusao
                descricao={`Apagar a imagem de ${imagem.stationName}?`}
                executar={apagar}
                ocupado={acao.executando}
              />
            )}
          </div>
        </div>
      </div>
      {revisando && (
        <RevisarImagem
          imagem={imagem}
          cancelar={() => setRevisando(false)}
          aoConfirmar={() => {
            setRevisando(false);
            atualizar();
          }}
        />
      )}
    </article>
  );
}
