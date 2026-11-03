export interface ImagemExemplo {
  arquivo: string;
  titulo: string;
  tipo: 'foto' | 'satelite';
  estacaoSugerida: string;
}

export const imagensExemplo: ImagemExemplo[] = [
  { arquivo: 'foto-lago.jpg', titulo: 'Lago com plantas aquáticas', tipo: 'foto', estacaoSugerida: 'LAG-01' },
  { arquivo: 'foto-rio-agua-limpa.jpg', titulo: 'Rio de água limpa', tipo: 'foto', estacaoSugerida: 'RIO-01' },
  { arquivo: 'foto-encontro-das-aguas.jpg', titulo: 'Encontro das Águas, Manaus', tipo: 'foto', estacaoSugerida: 'RIO-03' },
  { arquivo: 'foto-floracao-algas.jpg', titulo: 'Floração de algas', tipo: 'foto', estacaoSugerida: 'RES-01' },
  { arquivo: 'foto-espuma-poluicao.jpg', titulo: 'Espuma de poluição', tipo: 'foto', estacaoSugerida: 'RIO-02' },
  { arquivo: 'satelite-floracao-lago-erie.jpg', titulo: 'Satélite: floração no Lago Erie', tipo: 'satelite', estacaoSugerida: 'LAG-01' },
  { arquivo: 'satelite-rio-doce-lama.jpg', titulo: 'Satélite: lama no Rio Doce', tipo: 'satelite', estacaoSugerida: 'EST-01' },
];

export async function arquivoDoExemplo(exemplo: ImagemExemplo): Promise<File> {
  const resposta = await fetch(`/exemplos/${exemplo.arquivo}`);
  if (!resposta.ok) throw new Error('Não foi possível abrir a imagem de exemplo.');
  return new File([await resposta.blob()], exemplo.arquivo, { type: 'image/jpeg' });
}
