import type { Bloom, ImageAnalysis, ImageKind, ImageObservation, Riparian, Turbidity, Vegetation } from "../api/types";

export const KIND_LABEL: Record<ImageKind, string> = { foto: "Foto da água", satelite: "Imagem de satélite" };

export const ATTENTION: { level: 0 | 1 | 2 | 3; label: string; color: string }[] = [
  { level: 0, label: "Sem sinais", color: "var(--iqa-boa)" },
  { level: 1, label: "Atenção baixa", color: "var(--sev-atencao)" },
  { level: 2, label: "Atenção moderada", color: "var(--sev-alto)" },
  { level: 3, label: "Atenção alta", color: "var(--sev-critico)" },
];

type Option<T extends string> = { value: T; label: string };

const NA = { value: "nao_avaliavel", label: "Não dá para avaliar" } as const;

export const TURBIDITY: Option<Turbidity>[] = [
  { value: "baixa", label: "Baixa" }, { value: "media", label: "Média" }, { value: "alta", label: "Alta" }, NA,
];
export const BLOOM: Option<Bloom>[] = [
  { value: "nenhuma", label: "Nenhuma" }, { value: "possivel", label: "Possível" }, { value: "provavel", label: "Provável" }, NA,
];
export const VEGETATION: Option<Vegetation>[] = [
  { value: "ausente", label: "Ausente" }, { value: "pouca", label: "Pouca" }, { value: "abundante", label: "Abundante" }, NA,
];
export const RIPARIAN: Option<Riparian>[] = [
  { value: "preservada", label: "Preservada" }, { value: "parcial", label: "Parcial" }, { value: "ausente", label: "Ausente" }, NA,
];

export const labelOf = <T extends string>(options: Option<T>[], value: T | undefined) =>
  options.find((o) => o.value === value)?.label ?? "—";

/** Nome em português de cada indicador de cor calculado dos pixels. */
export const METRIC_LABEL: Record<string, string> = {
  media_vermelho: "Vermelho médio (0 a 255)",
  media_verde: "Verde médio (0 a 255)",
  media_azul: "Azul médio (0 a 255)",
  brilho_pct: "Brilho (%)",
  indice_verde_vermelho: "Índice verde-vermelho (de -1 a 1)",
  proporcao_azul: "Proporção de azul",
  fracao_esverdeada: "Fração esverdeada da imagem",
  fracao_escura: "Fração escura da imagem",
};

/** Análise em branco para o biólogo preencher quando a IA não conseguiu ler a imagem. */
export function blankAnalysis(kind: ImageKind): ImageAnalysis {
  const base: ImageAnalysis = {
    cor_da_agua: "", turbidez: "nao_avaliavel", floracao_algas: "nao_avaliavel", nivel_de_atencao: 0,
    resumo: "", o_que_conferir_em_campo: "", confianca: 0,
  };
  return kind === "satelite"
    ? { ...base, uso_do_entorno: "", vegetacao_ribeirinha: "nao_avaliavel" }
    : { ...base, espuma: false, oleo_ou_filme: false, material_flutuante: false, vegetacao_aquatica: "nao_avaliavel" };
}

/** Sinais em frases curtas, para o cartão da observação. */
export function signals(a: ImageAnalysis): string[] {
  const out: string[] = [];
  if (a.cor_da_agua) out.push(`Água ${a.cor_da_agua}`);
  if (a.turbidez !== "nao_avaliavel") out.push(`Turbidez ${labelOf(TURBIDITY, a.turbidez).toLowerCase()}`);
  if (a.floracao_algas !== "nao_avaliavel" && a.floracao_algas !== "nenhuma") out.push(`Floração de algas ${labelOf(BLOOM, a.floracao_algas).toLowerCase()}`);
  if (a.espuma) out.push("Espuma");
  if (a.oleo_ou_filme) out.push("Película de óleo");
  if (a.material_flutuante) out.push("Material flutuante");
  if (a.uso_do_entorno) out.push(`Entorno: ${a.uso_do_entorno}`);
  if (a.vegetacao_ribeirinha && a.vegetacao_ribeirinha !== "nao_avaliavel") out.push(`Mata ciliar ${labelOf(RIPARIAN, a.vegetacao_ribeirinha).toLowerCase()}`);
  return out;
}

export const attentionOf = (a: ImageAnalysis) => ATTENTION[a.nivel_de_atencao] ?? ATTENTION[0];

/** Pergunta pronta para o assistente sobre uma observação. */
export function questionAbout(o: ImageObservation, pointName: string): string {
  return `Considere a ${KIND_LABEL[o.kind].toLowerCase()} de ${pointName} em ${o.observed_on}. O que ela indica e o que devo verificar em campo?`;
}
