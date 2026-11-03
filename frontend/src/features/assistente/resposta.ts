// Lê a resposta da Limno: separa o texto dos marcadores de gráfico [[grafico estacao=X parametro=Y]]
// e quebra o texto em parágrafos e listas para exibir sem HTML.
export interface PedidoGrafico {
  estacao: string;
  parametro: string;
}

export type BlocoTexto = { tipo: 'paragrafo'; texto: string } | { tipo: 'lista'; itens: string[] };

const MARCADOR = /\[\[\s*grafico\s+estacao=([^\s\]]+)\s+parametro=([^\s\]]+)\s*\]\]/gi;
const PARAMETROS = new Set([
  'iqa', 'ph', 'doMgl', 'tempC', 'turbidityNtu', 'conductivityUscm', 'nitrateMgl', 'phosphorusMgl', 'coliformsNmp',
]);

export function separarGraficos(resposta: string): { texto: string; graficos: PedidoGrafico[] } {
  const graficos: PedidoGrafico[] = [];
  const texto = resposta
    .replace(MARCADOR, (_, estacao: string, parametro: string) => {
      const repetido = graficos.some((g) => g.estacao === estacao && g.parametro === parametro);
      if (PARAMETROS.has(parametro) && !repetido && graficos.length < 2) graficos.push({ estacao, parametro });
      return '';
    })
    .trim();
  return { texto, graficos };
}

export function emBlocos(texto: string): BlocoTexto[] {
  const blocos: BlocoTexto[] = [];
  for (const linha of texto.split('\n').map((l) => l.trim())) {
    if (!linha) continue;
    const item = linha.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    const ultimo = blocos[blocos.length - 1];
    if (item) {
      if (ultimo?.tipo === 'lista') ultimo.itens.push(item[1]);
      else blocos.push({ tipo: 'lista', itens: [item[1]] });
    } else {
      blocos.push({ tipo: 'paragrafo', texto: linha.replace(/^#+\s*/, '') });
    }
  }
  return blocos;
}

/** Divide um trecho em partes normais e em negrito (**assim**). */
export function partesNegrito(texto: string): { texto: string; negrito: boolean }[] {
  return texto
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((p) => (p.startsWith('**') && p.endsWith('**') ? { texto: p.slice(2, -2), negrito: true } : { texto: p, negrito: false }));
}
