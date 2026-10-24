import { useDbSummary } from "../api/client";

export function Footer() {
  const dataset = useDbSummary().data?.dataset;
  const origin = dataset?.source === "real" ? `Dados reais: ${dataset.name ?? "conjunto importado"}.` : "";
  return (
    <footer className="footer">
      <span className="footer-name">AquaML</span>
      <p>AquaML apoia o monitoramento de rios, lagos, reservatórios e estuários. {origin} Imagens e análises da IA são indícios: confirme em campo antes de decidir.</p>
    </footer>
  );
}
