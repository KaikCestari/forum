import { useState } from 'react';
export function ConfirmarExclusao({
  descricao,
  executar,
  ocupado = false,
  rotulo = 'Apagar',
}: {
  descricao: string;
  executar: () => Promise<void>;
  ocupado?: boolean;
  rotulo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  if (!aberto)
    return (
      <button
        type="button"
        className="botao perigo discreto"
        disabled={ocupado}
        onClick={() => setAberto(true)}
      >
        {rotulo}
      </button>
    );
  return (
    <div className="confirmacao" role="group" aria-label="Confirmar exclusão">
      <p>{descricao} Esta ação não pode ser desfeita.</p>
      <div className="acoes">
        <button
          type="button"
          className="botao perigo"
          disabled={ocupado}
          onClick={async () => {
            await executar();
            setAberto(false);
          }}
        >
          {ocupado ? 'Apagando…' : 'Confirmar exclusão'}
        </button>
        <button
          type="button"
          className="botao secundario"
          disabled={ocupado}
          onClick={() => setAberto(false)}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
