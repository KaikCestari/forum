import type { FormEvent } from 'react';
import type { ConfirmacaoImagem, ImagemAgua, Turbidez } from '../../api/tipos';
import { api } from '../../api/recursos';
import { useAcao } from '../../api/useAcao';
import { Erro } from '../../components/Estados';
const sinais = [
  ['algaeBloom', 'Floração de algas'],
  ['foam', 'Espuma'],
  ['oil', 'Óleo'],
  ['floatingDebris', 'Resíduos flutuantes'],
] as const;
export function RevisarImagem({
  imagem,
  aoConfirmar,
  cancelar,
}: {
  imagem: ImagemAgua;
  aoConfirmar: () => void;
  cancelar: () => void;
}) {
  const acao = useAcao();
  const leitura = imagem.vision;
  async function confirmar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const campos = new FormData(e.currentTarget);
    const body: ConfirmacaoImagem = {};
    if (campos.get('waterColor')) body.waterColor = String(campos.get('waterColor')).trim();
    if (campos.get('turbidity')) body.turbidity = campos.get('turbidity') as Turbidez;
    if (campos.get('notes')) body.notes = String(campos.get('notes')).trim();
    body.attentionLevel = Number(campos.get('attentionLevel')) as 0 | 1 | 2 | 3;
    for (const [chave] of sinais) {
      const valor = campos.get(chave);
      if (valor) body[chave] = valor === 'sim';
    }
    const resultado = await acao.executar(() => api.confirmarImagem(imagem.id, body));
    if (resultado) aoConfirmar();
  }
  return (
    <section className="revisao">
      <h3>Confira a leitura da imagem</h3>
      <p>A leitura visual descreve indícios. Ela não substitui as medições da água.</p>
      {imagem.analysisError && (
        <p className="aviso">
          {imagem.analysisError} Você pode registrar sua própria avaliação nos campos abaixo.
        </p>
      )}
      {leitura && (
        <blockquote>
          {leitura.summary}
          {leitura.surroundings && <p>Entorno: {leitura.surroundings}</p>}
        </blockquote>
      )}
      <Erro erro={acao.erro} />
      <form onSubmit={confirmar}>
        <fieldset disabled={acao.executando}>
          <div className="form-grid">
            <label>
              Cor da água
              <input
                name="waterColor"
                defaultValue={leitura?.waterColor ?? ''}
                placeholder="Descreva a cor observada"
              />
            </label>
            <label>
              Turbidez aparente
              <select name="turbidity" defaultValue={leitura?.turbidity ?? ''}>
                <option value="">Não foi possível avaliar</option>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </label>
            {sinais.map(([chave, titulo]) => (
              <label key={chave}>
                {titulo}
                <select
                  name={chave}
                  defaultValue={leitura?.[chave] == null ? '' : leitura[chave] ? 'sim' : 'nao'}
                >
                  <option value="">Não foi possível avaliar</option>
                  <option value="sim">Presente</option>
                  <option value="nao">Ausente</option>
                </select>
              </label>
            ))}
            <label>
              Nível de atenção
              <select name="attentionLevel" required defaultValue={leitura?.attentionLevel ?? ''}>
                <option value="" disabled>
                  Selecione sua avaliação
                </option>
                <option value="0">0 — Sem sinal de atenção</option>
                <option value="1">1 — Atenção baixa</option>
                <option value="2">2 — Atenção moderada</option>
                <option value="3">3 — Atenção alta</option>
              </select>
            </label>
          </div>
          <label>
            Observações da revisão (opcional)
            <textarea name="notes" rows={3} />
          </label>
          <div className="acoes">
            <button className="botao" disabled={acao.executando}>
              {acao.executando ? 'Confirmando…' : 'Confirmar leitura revisada'}
            </button>
            <button
              type="button"
              className="botao secundario"
              disabled={acao.executando}
              onClick={cancelar}
            >
              Revisar depois
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
