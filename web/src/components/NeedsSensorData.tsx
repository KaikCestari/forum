import { Link } from "react-router";
import { Icon } from "./Icon";

/** Seções que dependem de leituras de sensores, quando ainda não há nenhuma. */
export function NeedsSensorData({ title }: { title: string }) {
  return (
    <article>
      <header className="page-heading">
        <h1>{title}</h1>
        <p>Indicadores e análises a partir das suas leituras de sensores.</p>
      </header>
      <div className="feature-empty">
        <span className="empty-icon">
          <Icon name="stations" size={32} />
        </span>
        <h2>O próximo passo está nos seus dados</h2>
        <p>
          Importe uma planilha CSV de sensores para acompanhar a qualidade da
          água, explorar gráficos e identificar tendências.
        </p>
        <div className="needs-actions">
          <Link className="button-link" to="/dados?aba=importar">
            Importar uma planilha
          </Link>
          <Link className="inline-link" to="/imagens">
            Ou trabalhe com imagens
          </Link>
        </div>
      </div>
    </article>
  );
}
