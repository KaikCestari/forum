import { useEffect, useState } from 'react';
export function Espera({ texto, imagem = false }: { texto: string; imagem?: boolean }) {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setSegundos((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="espera">
      <p role="status">
        <span className="indicador" aria-hidden="true" /> {texto}
      </p>
      <p>
        Tempo decorrido:{' '}
        <span role="timer" aria-live="off">
          {segundos} s
        </span>
      </p>
      {imagem && (
        <p>
          {segundos <= 40
            ? 'A leitura da imagem costuma levar de 10 a 40 segundos. Aguarde nesta página.'
            : 'A leitura está levando mais tempo que o habitual. O servidor ainda está processando; aguarde para evitar um envio duplicado.'}
        </p>
      )}
    </div>
  );
}
