import { useOverview } from "../api/client";
import { HowItWorks } from "../components/HowItWorks";
import { IQA_COLOR, PARAM_ORDER } from "../lib/domain";
import { GLOSSARY, IQA_GUIDE, LIMIT_TEXT, PARAM_INFO } from "../lib/guide";

export default function GuideView() {
  const parameters = useOverview().data?.parameters;

  return (
    <article className="guide">
      <header className="guide-intro">
        <h1>Guia rápido</h1>
        <p className="lede">
          Como ler cada número e cada gráfico deste painel, sem jargão. Use esta página quando uma medida ou uma sigla não estiver clara.
        </p>
      </header>

      <section className="guide-block" aria-labelledby="guide-iqa">
        <h2 id="guide-iqa">Como ler o IQA</h2>
        <p className="block-intro">
          O Índice de Qualidade da Água (IQA) resume várias medidas numa nota de 0 a 100. Quanto maior, melhor. A cor e o nome da classe
          aparecem em todo o painel.
        </p>
        <ul className="iqa-guide">
          {IQA_GUIDE.map((g) => (
            <li key={g.cls}>
              <i style={{ background: IQA_COLOR[g.cls] }} aria-hidden="true" />
              <strong>{g.cls}</strong>
              <span className="iqa-range">{g.range}</span>
              <span>{g.meaning}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="guide-block" aria-labelledby="guide-params">
        <h2 id="guide-params">O que cada medida mostra</h2>
        <p className="block-intro">Os limites legais seguem a Resolução CONAMA 357/2005, classe 2, a mais comum para águas doces.</p>
        <dl className="param-guide">
          {PARAM_ORDER.map((p) => (
            <div key={p}>
              <dt>{parameters?.[p]?.label ?? p}{parameters?.[p]?.unit ? <span className="unit"> ({parameters[p].unit})</span> : null}</dt>
              <dd>
                <p>{PARAM_INFO[p].what}</p>
                <p>{PARAM_INFO[p].why}</p>
                <p className="param-limit">{LIMIT_TEXT[p] ? `Limite legal: ${LIMIT_TEXT[p]}.` : "Sem limite definido na CONAMA; use como contexto."}</p>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="guide-block" aria-labelledby="guide-ai">
        <h2 id="guide-ai">O que a IA faz</h2>
        <ul className="ai-guide">
          <li>
            <strong>Marca dias fora do padrão.</strong> Ela aprende como cada estação costuma ser e destaca os dias que fogem disso.
            Nem todo dia marcado é poluição: chuva forte também muda a água. Confirme em campo.
          </li>
          <li>
            <strong>Reconhece a classe da água.</strong> Só com as leituras dos sensores, ela diz se a água é Ótima, Boa, Regular, Ruim
            ou Péssima, e funciona mesmo com um sensor desligado.
          </li>
          <li>
            <strong>Aponta tendências.</strong> Compara cada mês com o mesmo mês do ano seguinte e avisa quando uma medida piora ou
            melhora de forma contínua.
          </li>
        </ul>
        <HowItWorks>
          <p>
            Dias fora do padrão: Isolation Forest combinado com z-score sobre os 30 dias anteriores. Classe da água: Random Forest. Perfis
            de ecossistema: K-Means sobre os meses, com PCA para o gráfico. Tendências: teste de Mann-Kendall sazonal com declive de Sen.
          </p>
        </HowItWorks>
      </section>

      <section className="guide-block" aria-labelledby="guide-images">
        <h2 id="guide-images">Como enviar imagens</h2>
        <p className="block-intro">Na seção Imagens você traz dados sem precisar de sensores: uma foto da água ou uma imagem de satélite.</p>
        <ol className="step-list">
          <li><strong>Escolha o tipo e a imagem.</strong> Foto tirada no local ou imagem de satélite, em JPG ou PNG de até 12 MB.</li>
          <li><strong>Informe a data e o ponto.</strong> Use um ponto que já existe ou crie um novo, com nome e, se quiser, latitude e longitude.</li>
          <li><strong>Espere a IA ler.</strong> Ela leva de 10 a 40 segundos e descreve cor da água, turbidez, sinais de floração e outros indícios.</li>
          <li><strong>Confira e corrija.</strong> Cada campo pode ser mudado. Se a IA não conseguir ler, você preenche à mão.</li>
          <li><strong>Confirme para salvar.</strong> Só observações confirmadas entram no relatório e nas respostas do assistente.</li>
        </ol>
        <p className="block-intro">
          A IA descreve apenas o que enxerga. A cor e a turbidez aparentes mudam com a luz, o ângulo e o reflexo do céu, e uma imagem de
          satélite comum não mede clorofila. Trate o resultado como indício e confirme com coleta e medição em campo.
        </p>
      </section>

      <section className="guide-block" aria-labelledby="guide-charts">
        <h2 id="guide-charts">Como ler os gráficos</h2>
        <ul className="legend legend-guide">
          <li><i className="line" style={{ background: "var(--water)" }} />Linha fina: valor de cada dia</li>
          <li><i className="line thick" style={{ background: "var(--accent)" }} />Linha grossa: média de 7 dias, que mostra a direção</li>
          <li><i className="tri" />Triângulo magenta: dia fora do padrão segundo a IA</li>
          <li><i className="dash" />Linha tracejada: limite legal da medida</li>
          <li><i style={{ background: "var(--water-light)" }} />Faixa clara: evento conhecido, uma ocorrência já registrada</li>
        </ul>
        <p className="block-intro">As cores dos alertas indicam a gravidade: crítico, alto, atenção e recorrente.</p>
      </section>

      <section className="guide-block" aria-labelledby="guide-glossary">
        <h2 id="guide-glossary">Glossário</h2>
        <dl className="glossary">
          {GLOSSARY.map((g) => (
            <div key={g.term}>
              <dt>{g.term}</dt>
              <dd>{g.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  );
}
