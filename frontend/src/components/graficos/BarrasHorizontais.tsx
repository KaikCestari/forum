import { numero } from '../formatacao';

export function BarrasHorizontais({
  itens,
  titulo,
  cor = 'var(--leito)',
}: {
  itens: { rotulo: string; valor: number; cor?: string }[];
  titulo: string;
  cor?: string;
}) {
  const maior = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <table className="barras">
      <caption className="sr-only">{titulo}</caption>
      <tbody>
        {itens.map((i) => (
          <tr key={i.rotulo}>
            <th scope="row">{i.rotulo}</th>
            <td>
              <span className="barra" style={{ width: `${(i.valor / maior) * 100}%`, background: i.cor ?? cor }} />
              <span className="barra-valor">{numero(i.valor, 0)}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
