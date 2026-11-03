// Apresenta perfis de água semelhantes e explica o método usado na análise.
import { ComoFunciona } from '../../components/Pagina';
import { EtapaAnalise } from './EtapaAnalise';
import { numero } from '../../components/formatacao';
import { GraficoGrupos } from './GraficoGrupos';
import type { ResultadoAnalise } from '../../api/tipos';
import { ListaProgressiva } from '../../components/ListaProgressiva';
export function Grupos({
  analise,
  nomes,
}: {
  analise: ResultadoAnalise;
  nomes: Record<string, string>;
}) {
  const parametro = (chave: string) => analise.parameters[chave]?.label ?? chave;
  return (
    <EtapaAnalise titulo="Perfis de água semelhantes" metodo={analise.clusters.method}>
      <p>
        Pontos próximos no gráfico têm características parecidas. Os nomes na legenda descrevem cada
        grupo; os números são identificadores e não indicam uma ordem de qualidade.
      </p>
      <GraficoGrupos
        pontos={analise.clusters.points}
        perfis={analise.clusters.profiles}
        nomes={nomes}
      />
      {analise.clusters.profiles.length ? (
        <ListaProgressiva itens={analise.clusters.profiles}>
          {(visiveis) => (
            <ul className="lista-registros">
              {visiveis.map((perfil) => (
                <li key={perfil.cluster}>
                  <h3>{perfil.label}</h3>
                  <p>
                    Grupo {perfil.cluster} · {numero(perfil.size, 0)} observações
                  </p>
                  <dl className="medidas">
                    {Object.entries(perfil.means).map(([p, valor]) => (
                      <div key={p}>
                        <dt>{parametro(p)}</dt>
                        <dd>
                          {numero(valor)} {analise.parameters[p]?.unit}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </ListaProgressiva>
      ) : (
        <p className="texto-apoio">Ainda não há grupos definidos.</p>
      )}
      <ComoFunciona algoritmo={analise.clusters.method}>
        K-Means agrupa observações semelhantes. PCA resume vários parâmetros em dois eixos para
        desenhar a dispersão. Esses eixos não são latitude e longitude.
      </ComoFunciona>
    </EtapaAnalise>
  );
}
