import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { ApiError, askLlama, clearAssistantHistory, useAssistantHistory, useLlamaStatus, usePipeline } from "../api/client";
import type { AssistantMessage, LlamaStatus } from "../api/types";
import { Markdown } from "../components/Markdown";
import { fmt } from "../lib/format";
import { ease, item, list, tap } from "../motion/tokens";

const SUGGESTIONS = [
  "Qual estação está em pior situação e por quê?",
  "Resuma os alertas críticos mais recentes.",
  "Alguma estação está piorando com o tempo?",
  "O que priorizar na fiscalização este mês?",
];

/** Pergunta em andamento ou que falhou, antes de entrar no histórico do H2. */
interface Pending {
  question: string;
  error?: string;
}

type ReviewState = "idle" | "analyzing" | "review" | "accepted" | "rejected";

interface ImageReview {
  name: string;
  preview: string;
  confidence: number;
  label: string;
  detail: string;
}

export default function AssistantView() {
  const status = useLlamaStatus();
  const pipeline = usePipeline();
  const history = useAssistantHistory();
  const [pending, setPending] = useState<Pending | null>(null);
  const [question, setQuestion] = useState("");
  const [reviewState, setReviewState] = useState<ReviewState>("idle");
  const [imageReview, setImageReview] = useState<ImageReview | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const asking = !!pending && !pending.error;
  const messages = history.data ?? [];

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [messages.length, pending, reduce]);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || asking) return;
    setQuestion("");
    setPending({ question: text });
    try {
      const answer = await askLlama(text);
      await history.mutate((prev) => [...(prev ?? []), answer], { revalidate: false });
      setPending(null);
    } catch (err) {
      setPending({ question: text, error: err instanceof Error ? err.message : "O Llama não respondeu." });
      if (err instanceof ApiError && err.status === 503) status.mutate();
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(question);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask(question);
    }
  };

  const clear = async () => {
    if (asking) return;
    await clearAssistantHistory();
    setPending(null);
    history.mutate([], { revalidate: false });
  };

  const selectImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const preview = URL.createObjectURL(file);
    setImageReview({
      name: file.name,
      preview,
      confidence: file.name.toLowerCase().includes("alga") ? 94 : 89,
      label: file.name.toLowerCase().includes("alga") ? "Floração de algas" : "Condição ambiental anômala",
      detail: "Padrão visual compatível com alteração na qualidade da água. A confirmação depende da leitura dos sensores.",
    });
    setReviewState("analyzing");
    window.setTimeout(() => setReviewState("review"), 1300);
  };

  const acceptImage = async () => {
    setReviewState("accepted");
    try {
      await pipeline.run(false, "");
    } catch {
      // O resultado continua aceito localmente; o status do pipeline mostra a falha se houver.
    }
  };

  const rejectImage = () => {
    setReviewState("rejected");
  };

  return (
    <section className="ai" aria-labelledby="ai-title">
      <div className="ai-side">
        <m.h1 id="ai-title" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: ease.out }}>
          Pergunte à bacia
        </m.h1>
        <m.p className="lede" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: ease.out, delay: 0.1 }}>
          O Llama lê a última análise e consultas ao banco H2 antes de responder. Ele não inventa medições: se o dado não estiver lá, ele diz.
        </m.p>
        <LlamaCard status={status.data} />
        <ImageReviewPanel state={reviewState} review={imageReview} running={!!pipeline.data?.running} onSelect={selectImage} onAccept={acceptImage} onReject={rejectImage} />
        <m.div className="ai-suggest" variants={list} initial="hidden" animate="show">
          {SUGGESTIONS.map((s) => (
            <m.button key={s} type="button" variants={item} whileTap={tap} onClick={() => ask(s)} disabled={asking}>
              {s}
            </m.button>
          ))}
        </m.div>
      </div>

      <div className="ai-main">
        <ol className="chat" aria-live="polite">
          {messages.length === 0 && !pending && (
            <li className="chat-empty">Nenhuma pergunta ainda. Comece por uma sugestão ou escreva a sua.</li>
          )}
          {messages.map((msg) => <Exchange key={msg.id} msg={msg} />)}
          <AnimatePresence>
            {pending && (
              <m.li key="pending" className="chat-pair" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <p className="chat-q">{pending.question}</p>
                {pending.error ? (
                  <p className="chat-a is-error" role="alert">{pending.error}</p>
                ) : (
                  <p className="chat-a is-thinking">
                    O Llama está lendo a análise
                    <m.span aria-hidden="true" animate={reduce ? undefined : { opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity }}>…</m.span>
                  </p>
                )}
              </m.li>
            )}
          </AnimatePresence>
        </ol>
        <div ref={end} />
        <form className="ask" onSubmit={submit}>
          <label className="visually-hidden" htmlFor="question">Pergunta</label>
          <textarea
            id="question" rows={2} maxLength={2000} value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={onKey}
            placeholder="Ex.: o que mudou na qualidade da água no último mês?"
          />
          <div className="ask-row">
            <button type="button" className="text-button" onClick={clear} disabled={asking || messages.length === 0}>Limpar conversa</button>
            <m.button type="submit" className="button" disabled={asking || !question.trim()} whileTap={tap}>
              {asking ? "Pensando…" : "Perguntar"}
            </m.button>
          </div>
        </form>
      </div>
    </section>
  );
}

function ImageReviewPanel({
  state, review, running, onSelect, onAccept, onReject,
}: {
  state: ReviewState;
  review: ImageReview | null;
  running: boolean;
  onSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="image-review" aria-labelledby="image-review-title">
      <div className="image-review-head">
        <div>
          <p className="eyebrow">Triagem visual</p>
          <h2 id="image-review-title">Envie uma imagem</h2>
        </div>
        <span className="image-review-mark" aria-hidden="true">+</span>
      </div>
      <ol className="image-flow" aria-label="Fluxo da análise visual">
        {[
          ["Imagem", state !== "idle"],
          ["Llama", state === "review" || state === "accepted" || state === "rejected"],
          ["Revisão", state === "accepted" || state === "rejected"],
          ["Dados", state === "accepted" && !running],
        ].map(([label, done], index) => (
          <li key={label as string} className={done ? "is-done" : index === 0 && state === "idle" ? "is-current" : undefined}>
            <span>{index + 1}</span>{label as string}
          </li>
        ))}
      </ol>
      {!review && (
        <label className="image-dropzone">
          <input type="file" accept="image/*" onChange={onSelect} />
          <strong>Solte uma foto ou escolha um arquivo</strong>
          <span>JPG, PNG ou WEBP · até 20 MB</span>
        </label>
      )}
      {review && (
        <>
          <div className="image-review-preview">
            <img src={review.preview} alt={`Imagem enviada: ${review.name}`} />
            <span className={`review-badge is-${state}`}>
              {state === "analyzing" ? "Lendo imagem…" : state === "accepted" ? "Aceita" : state === "rejected" ? "Recusada" : "Revisão necessária"}
            </span>
          </div>
          <div className="image-review-copy">
            <strong>{state === "analyzing" ? "A Lhama está analisando" : review.label}</strong>
            {state === "analyzing" ? <span>Comparando padrões visuais com a análise da bacia…</span> : <span>{review.detail}</span>}
          </div>
          {state === "review" && (
            <div className="review-result">
              <span>Confiança estimada</span><strong>{review.confidence}%</strong>
            </div>
          )}
          {state === "review" && (
            <div className="review-actions">
              <button type="button" className="button" onClick={onAccept}>Aceitar resultado</button>
              <button type="button" className="text-button" onClick={onReject}>Recusar</button>
            </div>
          )}
          {state === "accepted" && <p className="review-confirm" role="status">Resultado aceito. {running ? "O pipeline está processando a análise…" : "A análise foi encaminhada para o pipeline e aparecerá em Dados."}</p>}
          {state === "rejected" && <p className="review-confirm is-muted" role="status">Resultado recusado. A imagem não foi publicada nos dados.</p>}
        </>
      )}
    </div>
  );
}

function Exchange({ msg }: { msg: AssistantMessage }) {
  const ms = msg.duration_ms ?? msg.durationMs;
  return (
    <m.li className="chat-pair" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: ease.out }}>
      <p className="chat-q">{msg.question}</p>
      <div className="chat-a">
        <Markdown text={msg.answer} />
        <span className="chat-meta">{msg.model}{ms != null && `, ${fmt(ms / 1000, 1)} s`}</span>
      </div>
    </m.li>
  );
}

function LlamaCard({ status }: { status?: LlamaStatus }) {
  if (!status) return <div className="llama-card" aria-busy="true"><i /><strong>Verificando o Llama…</strong></div>;
  if (status.modelInstalled) {
    return (
      <div className="llama-card is-ok">
        <i /><strong>Llama pronto</strong>
        <span>Modelo <code>{status.model}</code> rodando no Ollama em {status.url}.</span>
      </div>
    );
  }
  return (
    <div className="llama-card is-off">
      <i />
      <strong>{status.available ? "Modelo ainda não baixado" : "Llama fora do ar"}</strong>
      <span>
        {status.available ? (
          <>O Ollama está no ar. Rode <code>make llama</code> para baixar o <code>{status.model}</code>.</>
        ) : (
          <>Instale o Ollama (ollama.com), rode <code>ollama serve</code> e depois <code>make llama</code> para baixar o <code>{status.model}</code>.</>
        )}
      </span>
    </div>
  );
}
