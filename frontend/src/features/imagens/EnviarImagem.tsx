// Envia JPG ou PNG para uma estação, com validação local e feedback da leitura visual.
import { useState, type FormEvent } from 'react';
import type { Estacao, ImagemAgua } from '../../api/tipos';
import { api } from '../../api/recursos';
import { useAcao } from '../../api/useAcao';
import { useAuth } from '../../auth/AuthContext';
import { Erro } from '../../components/Estados';
import { Espera } from '../../components/Espera';
import { hoje, tiposEstacao } from '../../components/formatacao';
export function EnviarImagem({
  estacoes,
  aoEnviar,
}: {
  estacoes: Estacao[];
  aoEnviar: (imagem: ImagemAgua) => void;
}) {
  const { usuario } = useAuth();
  const acao = useAcao();
  const [novaEstacao, setNovaEstacao] = useState(false);
  const [erroArquivo, setErroArquivo] = useState('');
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulario = e.currentTarget;
    const campos = new FormData(formulario);
    const arquivo = campos.get('file');
    setErroArquivo('');
    if (
      !(arquivo instanceof File) ||
      !['image/jpeg', 'image/png'].includes(arquivo.type) ||
      arquivo.size > 12 * 1024 * 1024 ||
      arquivo.size === 0
    ) {
      setErroArquivo('Escolha uma imagem JPG ou PNG de até 12 MB.');
      return;
    }
    for (const nome of ['lat', 'lon']) if (!campos.get(nome)) campos.delete(nome);
    if (campos.has('newStationName'))
      campos.set('newStationName', String(campos.get('newStationName')).trim());
    const resposta = await acao.executar(() => api.enviarImagem(campos));
    if (resposta) {
      formulario.reset();
      setNovaEstacao(false);
      aoEnviar(resposta.valor);
    }
  }
  return (
    <section className="bloco">
      <h2>Registrar uma observação</h2>
      <p className="texto-apoio">
        Envie uma foto da água ou uma imagem de satélite. Você poderá corrigir a leitura antes de
        confirmar.
      </p>
      <Erro erro={erroArquivo || acao.erro} />
      <form onSubmit={enviar}>
        <fieldset disabled={acao.executando}>
          <div className="form-grid">
            <label className="campo-arquivo">
              Imagem (JPG ou PNG, até 12 MB)
              <input name="file" type="file" accept="image/jpeg,image/png" required />
            </label>
            <label>
              Tipo de imagem
              <select name="kind">
                <option value="foto">Foto da água</option>
                <option value="satelite">Imagem de satélite</option>
              </select>
            </label>
            <label>
              Data da observação
              <input name="observedOn" type="date" defaultValue={hoje()} required />
            </label>
            {!novaEstacao && (
              <label>
                Ponto de monitoramento
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
            )}
          </div>
          {usuario?.role === 'ADMIN' && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={novaEstacao}
                onChange={(e) => setNovaEstacao(e.target.checked)}
              />
              Cadastrar um novo ponto com esta imagem
            </label>
          )}
          {novaEstacao && (
            <div className="form-grid">
              <label>
                Nome do novo ponto
                <input name="newStationName" required maxLength={150} />
              </label>
              <label>
                Tipo de ambiente
                <select name="newStationType">
                  {Object.entries(tiposEstacao).map(([v, n]) => (
                    <option key={v} value={v}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Latitude (opcional)
                <input name="lat" type="number" min="-90" max="90" step="any" />
              </label>
              <label>
                Longitude (opcional)
                <input name="lon" type="number" min="-180" max="180" step="any" />
              </label>
            </div>
          )}
          {!estacoes.length && !novaEstacao && (
            <p className="aviso">
              {usuario?.role === 'ADMIN'
                ? 'Marque a opção de cadastrar um novo ponto para enviar a primeira imagem.'
                : 'Peça ao administrador para cadastrar uma estação antes do envio.'}
            </p>
          )}
          <button
            className="botao"
            disabled={acao.executando || (!estacoes.length && !novaEstacao)}
          >
            {acao.executando ? 'Lendo imagem…' : 'Enviar para leitura'}
          </button>
        </fieldset>
      </form>
      {acao.executando && <Espera texto="A IA está examinando a imagem." imagem />}
    </section>
  );
}
