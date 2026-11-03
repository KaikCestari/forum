// Filtra a gravidade dos alertas da estação selecionada e limita a lista inicial a dez.
import { useState } from 'react';
import type { ResultadoAnalise } from '../../api/tipos';
import { Bloco, ComoFunciona } from '../../components/Pagina';
import { ListaAlertas } from '../../components/ListaAlertas';
import { ListaProgressiva } from '../../components/ListaProgressiva';
export function AlertasAnalise({
  analise,
  nomes,
}: {
  analise: ResultadoAnalise;
  nomes: Record<string, string>;
}) {
  const [gravidade, setGravidade] = useState('');
  const alertas = analise.alerts.filter((a) => !gravidade || a.severity === gravidade);
  return (
    <Bloco titulo="Sinais que pedem atenção">
      <p>Parâmetros que ultrapassaram os limites de referência.</p>
      <div className="form-grid">
        <label>
          Gravidade
          <select value={gravidade} onChange={(e) => setGravidade(e.target.value)}>
            <option value="">Todas</option>
            <option value="atencao">Atenção</option>
            <option value="critico">Crítico</option>
          </select>
        </label>
      </div>
      <ListaProgressiva key={gravidade} itens={alertas}>
        {(visiveis) => <ListaAlertas alertas={visiveis} nomes={nomes} />}
      </ListaProgressiva>
      <ComoFunciona algoritmo="Regras por limites de referência CONAMA 357">
        Cada valor é comparado aos limites configurados na análise. Um alerta orienta a investigação
        e deve ser interpretado junto às condições locais e às observações de campo. Dias
        consecutivos com o mesmo alerta formam um episódio: a data exibida é a do último dia e o
        valor é o pior registrado nesse episódio.
      </ComoFunciona>
    </Bloco>
  );
}
