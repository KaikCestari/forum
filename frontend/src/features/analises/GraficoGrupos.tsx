// Desenha pontos pequenos e transparentes; identifica grupos na legenda e na tabela progressiva.
import type { PerfilGrupo, PontoGrupo } from '../../api/tipos';
import { data, numero } from '../../components/formatacao';
import { ListaProgressiva } from '../../components/ListaProgressiva';
const cores = ['#000000', '#db0000', '#e3a400', '#4a7a4a', '#8a5a3a'];
const corGrupo = (id: number) => cores[Math.abs(id) % cores.length];
export function GraficoGrupos({
  pontos,
  perfis,
  nomes,
}: {
  pontos: PontoGrupo[];
  perfis: PerfilGrupo[];
  nomes: Record<string, string>;
}) {
  if (!pontos.length)
    return <p className="texto-apoio">Ainda não há pontos suficientes para mostrar a dispersão.</p>;
  const xs = pontos.map((p) => p.x);
  const ys = pontos.map((p) => p.y);
  const xmin = Math.min(...xs);
  const ymin = Math.min(...ys);
  const dx = Math.max(...xs) - xmin || 1;
  const dy = Math.max(...ys) - ymin || 1;
  const rotulos = new Map(perfis.map((perfil) => [perfil.cluster, perfil.label]));
  const nomeGrupo = (id: number) => `${rotulos.get(id) ?? 'Perfil não informado'} (grupo ${id})`;
  return (
    <div className="grafico">
      <svg
        viewBox="0 0 660 280"
        role="img"
        aria-label={`Dispersão dos grupos com ${pontos.length} observações. Pontos próximos têm características semelhantes. Os grupos são identificados na legenda e na tabela.`}
      >
        <line x1="40" x2="620" y1="240" y2="240" className="grade-grafico" />
        <line x1="40" x2="40" y1="20" y2="240" className="grade-grafico" />
        {pontos.map((p, i) => (
          <circle
            key={i}
            cx={60 + ((p.x - xmin) / dx) * 540}
            cy={220 - ((p.y - ymin) / dy) * 180}
            r={pontos.length > 500 ? 2 : 3}
            fill={corGrupo(p.cluster)}
            fillOpacity={pontos.length > 500 ? 0.4 : 0.65}
          >
            <title>
              {nomes[p.stationId] ?? p.stationId}, {data(p.date)}, {nomeGrupo(p.cluster)}
            </title>
          </circle>
        ))}
        <text x="330" y="270" textAnchor="middle">
          Proximidade entre perfis de água
        </text>
      </svg>
      <ul className="legenda-grupos" aria-label="Legenda dos grupos">
        {perfis.map((perfil) => (
          <li key={perfil.cluster}>
            <span aria-hidden="true" style={{ backgroundColor: corGrupo(perfil.cluster) }} />
            {nomeGrupo(perfil.cluster)}
          </li>
        ))}
      </ul>
      <p className="texto-apoio">
        {numero(pontos.length, 0)} observações no gráfico. Regiões mais intensas indicam
        sobreposição de pontos.
      </p>
      <details>
        <summary>Ver pontos em tabela</summary>
        <ListaProgressiva itens={pontos}>
          {(visiveis) => (
            <div
              className="tabela-rolagem tabela-grafico"
              tabIndex={0}
              role="region"
              aria-label="Pontos da dispersão"
            >
              <table>
                <caption>Posição dos pontos na dispersão (PCA)</caption>
                <thead>
                  <tr>
                    <th>Estação</th>
                    <th>Data</th>
                    <th>Grupo</th>
                    <th>Eixo 1</th>
                    <th>Eixo 2</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((p, i) => (
                    <tr key={i}>
                      <td>{nomes[p.stationId] ?? p.stationId}</td>
                      <td>{data(p.date)}</td>
                      <td>{nomeGrupo(p.cluster)}</td>
                      <td>{numero(p.x, 3)}</td>
                      <td>{numero(p.y, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ListaProgressiva>
      </details>
    </div>
  );
}
