import { useDbSummary } from "../api/client";

export function Footer() {
  const dataset = useDbSummary().data?.dataset;
  const origin = dataset?.source === "real" ? `Dados reais: ${dataset.name ?? "conjunto importado"}.` : "Os dados são sintéticos.";
  return (
    <footer className="footer">
      <span className="footer-name">AquaML</span>
      <p>Protótipo acadêmico de monitoramento de ecossistemas aquáticos com Java 21, Rust, Python, H2 e Llama. {origin}</p>
    </footer>
  );
}
