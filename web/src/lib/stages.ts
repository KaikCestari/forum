/** Etapas da atualização, descritas pelo que fazem. O nome da tecnologia fica só como detalhe. */
export const STAGES = [
  { key: "dados", title: "Receber as leituras", match: /Geração|Importação/, tech: "Dados", what: "Entram as leituras dos sensores, vindas da planilha que você importou." },
  { key: "guardar", title: "Guardar no banco", match: /Carga|Exportação/, tech: "H2", what: "Tudo fica guardado no banco de dados, e cada atualização parte do que está lá." },
  { key: "limpar", title: "Limpar e calcular o IQA", match: /Processamento/, tech: "Rust", what: "Descarta leituras impossíveis, preenche pequenas falhas, resume por dia e calcula o IQA." },
  { key: "ia", title: "Procurar padrões com a IA", match: /Análise com/, tech: "Python", what: "A IA marca os dias fora do padrão, reconhece a classe da água e aponta tendências." },
  { key: "publicar", title: "Publicar os resultados", match: /Gravação/, tech: "Java", what: "Resultados e alertas são gravados e passam a aparecer neste painel e no assistente." },
] as const;

/** Nome da etapa em linguagem simples; sem correspondência, devolve o nome original. */
export function friendlyStep(name: string): string {
  return STAGES.find((s) => s.match.test(name))?.title ?? name;
}
