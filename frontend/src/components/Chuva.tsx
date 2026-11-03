// Chuva de caracteres do tema Matrix no painel do login. Usa letras de parâmetros da água
// (pH, OD, IQA…) e para quando a pessoa prefere menos movimento.
import { useEffect, useRef } from 'react';

const SIMBOLOS = '0123456789IQApHODNTUCONAMA357H2OµS°C'.split('');

export function Chuva() {
  const tela = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = tela.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const parado = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const passo = 18;
    let colunas: number[] = [];
    let quadro = 0;
    let ultimo = 0;

    function medir() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      colunas = Array.from({ length: Math.ceil(canvas.width / passo) }, () =>
        Math.floor((Math.random() * canvas.height) / passo),
      );
    }
    function desenhar(agora: number) {
      quadro = requestAnimationFrame(desenhar);
      if (agora - ultimo < 60 || !canvas || !ctx) return;
      ultimo = agora;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${passo}px VT323, monospace`;
      colunas.forEach((linha, i) => {
        const letra = SIMBOLOS[Math.floor(Math.random() * SIMBOLOS.length)];
        ctx.fillStyle = Math.random() > 0.96 ? '#ccffd8' : '#00ff41';
        ctx.fillText(letra, i * passo, linha * passo);
        colunas[i] = linha * passo > canvas.height && Math.random() > 0.975 ? 0 : linha + 1;
      });
    }

    medir();
    window.addEventListener('resize', medir);
    if (parado) {
      for (let i = 0; i < 40; i++) desenhar(i * 100);
      cancelAnimationFrame(quadro);
    } else {
      quadro = requestAnimationFrame(desenhar);
    }
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener('resize', medir);
    };
  }, []);

  return <canvas ref={tela} className="chuva" aria-hidden="true" />;
}
