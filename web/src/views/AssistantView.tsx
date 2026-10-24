import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { ApiError, askLlama, clearAssistantHistory, useAssistantHistory, useLlamaStatus } from "../api/client";
import type { AssistantMessage, LlamaStatus } from "../api/types";
import { Markdown } from "../components/Markdown";
import { fmt } from "../lib/format";
import { ease, tap } from "../motion/tokens";
import { assistantErrorMessage } from "../lib/errors";

const SUGGESTIONS = [
  { title: "Onde a água piorou", text: "Qual estação está em pior situação e por quê?" },
  { title: "Risco de eutrofização", text: "Alguma estação mostra sinais de eutrofização? Considere fósforo, nitrato e oxigênio." },
  { title: "Alertas recentes", text: "Resuma os alertas críticos mais recentes e o que verificar em campo." },
  { title: "Plano de coleta", text: "Onde e o que devo coletar em campo neste mês, em ordem de prioridade?" },
];

/** Pergunta em andamento ou que falhou, antes de entrar no histórico do H2. */
interface Pending {
  question: string;
  error?: boolean;
  status?: number;
}

const MAX_TEXTAREA = 200;

export default function AssistantView() {
  const status = useLlamaStatus();
  const history = useAssistantHistory();
  const [pending, setPending] = useState<Pending | null>(null);
  const [question, setQuestion] = useState("");
  const [clearError, setClearError] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const reduce = useReducedMotion();
  const asking = !!pending && !pending.error;
  const messages = history.data ?? [];
  const empty = messages.length === 0 && !pending;

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
  }, [messages.length, pending, reduce]);

  // A caixa cresce com o texto, até um limite, como nos chats de uso geral.
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA)}px`;
  }, [question]);

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
      setPending({ question: text, error: true, status: err instanceof ApiError ? err.status : undefined });
      if (err instanceof ApiError && err.status === 503) status.mutate();
    }
  };

  // Quem chega de um alerta ("Perguntar ao assistente") traz a pergunta pronta na URL.
  const [params, setParams] = useSearchParams();
  const fromLink = useRef(false);
  useEffect(() => {
    const q = params.get("pergunta");
    if (!q || fromLink.current) return;
    fromLink.current = true;
    setParams({}, { replace: true });
    ask(q);
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(question);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      ask(question);
    }
  };

  const clear = async () => {
    if (asking) return;
    setClearError(false);
    try {
      await clearAssistantHistory();
      setPending(null);
      await history.mutate([], { revalidate: false });
    } catch { setClearError(true); }
  };

  const ready = !!status.data?.modelInstalled;

  return (
    <section className="chat-shell" aria-label="Assistente da bacia">
      <header className="chat-top">
        <h1>Assistente da bacia</h1>
        <LlamaPill status={status.data} />
        <button type="button" className="chat-clear" onClick={clear} disabled={asking || messages.length === 0}>
          <ClearIcon />Limpar conversa
        </button>
      </header>

      <div className="chat-scroll">
        <div className="chat-thread">
          {(status.error || (status.data && !ready)) && <LlamaNotice />}
          {clearError && <p className="chat-body is-error" role="alert">Não foi possível limpar a conversa. Tente novamente.</p>}

          {empty && (
            <div className="chat-hello">
              <DropMark />
              <h2>Como posso ajudar na análise da bacia?</h2>
              <p>
                Respondo com base na última análise, nas imagens que você confirmou e nas anotações do caderno de campo. Se a
                informação não estiver lá, eu aviso em vez de inventar.
              </p>
              <ul className="chat-prompts" aria-label="Sugestões de pergunta">
                {SUGGESTIONS.map((s) => (
                  <li key={s.text}>
                    <button type="button" onClick={() => ask(s.text)} disabled={asking}>
                      <strong>{s.title}</strong>
                      <span>{s.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ol className="chat" aria-live="polite">
            {messages.map((msg) => <Exchange key={msg.id} msg={msg} />)}
            <AnimatePresence>
              {pending && (
                <m.li key="pending" className="chat-pair" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="chat-q">{pending.question}</p>
                  <div className="chat-a">
                    <Avatar />
                    {pending.error ? (
                      <p className="chat-body is-error" role="alert">{assistantErrorMessage({ status: pending.status })}</p>
                    ) : (
                      <p className="chat-body is-thinking">
                        Lendo a análise
                        <span className="dots" aria-hidden="true"><i /><i /><i /></span>
                      </p>
                    )}
                  </div>
                </m.li>
              )}
            </AnimatePresence>
          </ol>

          <div ref={end} />
        </div>
      </div>

      <form className="composer" onSubmit={submit}>
        <div className="composer-box">
          <Link className="composer-attach" to="/imagens" title="Enviar uma foto da água ou imagem de satélite">
            <AttachIcon />
            <span className="visually-hidden">Enviar imagem para análise</span>
          </Link>
          <label className="visually-hidden" htmlFor="question">Pergunta</label>
          <textarea
            id="question" ref={field} rows={1} maxLength={2000} value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={onKey}
            placeholder="Pergunte sobre a bacia"
          />
          <m.button type="submit" className="composer-send" disabled={asking || !question.trim()} whileTap={tap} aria-label={asking ? "Aguardando resposta" : "Enviar pergunta"}>
            <SendIcon />
          </m.button>
        </div>
        <p className="composer-hint">Enter envia e Shift+Enter quebra a linha. Confira os valores no painel antes de decidir em campo.</p>
      </form>
    </section>
  );
}

function Exchange({ msg }: { msg: AssistantMessage }) {
  const ms = msg.duration_ms ?? msg.durationMs;
  return (
    <m.li className="chat-pair" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: ease.out }}>
      <p className="chat-q">{msg.question}</p>
      <div className="chat-a">
        <Avatar />
        <div className="chat-body">
          <Markdown text={msg.answer} />
          {ms != null && <span className="chat-meta">Respondido em {fmt(ms / 1000, 1)} s</span>}
        </div>
      </div>
    </m.li>
  );
}

function LlamaPill({ status }: { status?: LlamaStatus }) {
  const ok = !!status?.modelInstalled;
  const label = !status ? "Verificando" : ok ? "Assistente pronto" : "Assistente indisponível";
  return (
    <span className={`llama-pill ${!status ? "" : ok ? "is-ok" : "is-off"}`} role="status">
      <i aria-hidden="true" />{label}
    </span>
  );
}

function LlamaNotice() {
  return (
    <div className="llama-notice" role="note">
      <strong>O assistente está indisponível no momento</strong>
      <p>
        Tente novamente em alguns instantes. Se o problema continuar, entre em contato com a equipe responsável.
      </p>
    </div>
  );
}

const DropMark = () => (
  <svg className="drop-mark" viewBox="0 0 32 32" width="40" height="40" aria-hidden="true">
    <path d="M16 3 C16 3 6 14 6 20 a10 10 0 0 0 20 0 C26 14 16 3 16 3 Z" fill="currentColor" />
  </svg>
);

const Avatar = () => (
  <span className="chat-avatar" aria-hidden="true">
    <svg viewBox="0 0 32 32" width="16" height="16"><path d="M16 4 C16 4 7 14 7 20 a9 9 0 0 0 18 0 C25 14 16 4 16 4 Z" fill="currentColor" /></svg>
  </span>
);

const iconProps = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const SendIcon = () => <svg {...iconProps}><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>;
const AttachIcon = () => <svg {...iconProps}><path d="m21 11-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9" /></svg>;
const ClearIcon = () => <svg {...iconProps} width={16} height={16}><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" /><path d="M9 7V4h6v3" /></svg>;
