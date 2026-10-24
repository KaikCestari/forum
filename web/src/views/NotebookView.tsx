import { Link, useSearchParams } from "react-router";
import { usePoints } from "../api/client";
import type { Overview } from "../api/types";
import { Icon } from "../components/Icon";
import { NotesPanel } from "../components/NotesPanel";

export default function NotebookView({ data }: { data?: Overview }) {
  const points = usePoints();
  const [params, setParams] = useSearchParams();
  const places = [
    ...new Map(
      [...(data?.stations ?? []), ...(points.data ?? [])].map((p) => [p.id, p]),
    ).values(),
  ];
  const selected =
    places.find((p) => p.id === params.get("ponto")) ?? places[0];

  return (
    <article className="notebook">
      <header className="page-heading">
        <h1>Caderno de campo</h1>
        <p>
          Observações, coletas e ocorrências organizadas por ponto de
          monitoramento.
        </p>
      </header>
      {selected ? (
        <>
          <label className="note-field notebook-picker">
            <span>Ponto de monitoramento</span>
            <select
              aria-label="Ponto de monitoramento"
              value={selected.id}
              onChange={(e) => setParams({ ponto: e.target.value })}
            >
              {places.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <NotesPanel key={selected.id} station={selected} />
        </>
      ) : (
        <div className="feature-empty">
          <span className="empty-icon">
            <Icon name="notes" size={30} />
          </span>
          <h2>
            {points.error
              ? "Não foi possível carregar os pontos"
              : points.isLoading
                ? "Carregando pontos…"
                : "Cada observação começa em um ponto"}
          </h2>
          <p>
            {points.error
              ? "Verifique a conexão com o servidor para acessar suas anotações."
              : "Envie uma imagem para cadastrar um ponto ou importe as leituras de uma estação. Depois, registre suas observações aqui."}
          </p>
          <Link to="/imagens" className="button-link">
            Cadastrar ponto por imagem
          </Link>
        </div>
      )}
    </article>
  );
}
