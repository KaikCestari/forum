// Define o cabeçalho de uma página e blocos de conteúdo reutilizáveis.
import type { ReactNode } from 'react';
export function Pagina({
  titulo,
  descricao,
  acoes,
  children,
}: {
  titulo: string;
  descricao: string;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <header className="cabecalho-pagina">
        <div>
          <h1>{titulo}</h1>
          <p>{descricao}</p>
        </div>
        {acoes && <div className="acoes">{acoes}</div>}
      </header>
      {children}
    </>
  );
}
export function Bloco({
  titulo,
  children,
  className = '',
}: {
  titulo: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bloco ${className}`}>
      <h2>{titulo}</h2>
      {children}
    </section>
  );
}
export function ComoFunciona({ algoritmo, children }: { algoritmo: string; children: ReactNode }) {
  return (
    <details className="como-funciona">
      <summary>Como funciona</summary>
      <p>{children}</p>
      <p className="texto-apoio">Método: {algoritmo}.</p>
    </details>
  );
}
export function Selo({
  children,
  tom = 'neutro',
}: {
  children: ReactNode;
  tom?: 'neutro' | 'bom' | 'atencao' | 'critico';
}) {
  return <span className={`selo ${tom}`}>{children}</span>;
}
