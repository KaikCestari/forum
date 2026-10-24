import { Link } from "react-router";

/** Seções que dependem de leituras de sensores, quando ainda não há nenhuma. */
export function NeedsSensorData({ title }: { title: string }) {
  return (
    <article className="welcome">
      <header>
        <h1>{title}</h1>
        <p className="lede">Esta seção usa leituras de sensores, e ainda não há nenhuma. Importe uma planilha CSV para liberá-la.</p>
      </header>
      <div className="needs-actions">
        <Link className="button-link" to="/dados">Importar uma planilha</Link>
        <Link className="inline-link" to="/imagens">Ou trabalhe com imagens</Link>
      </div>
    </article>
  );
}
