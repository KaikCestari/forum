import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { apiUrl, confirmImage, deleteImage } from "../api/client";
import type { ImageAnalysis, ImageObservation } from "../api/types";
import {
  ATTENTION, BLOOM, KIND_LABEL, METRIC_LABEL, RIPARIAN, TURBIDITY, VEGETATION, attentionOf, blankAnalysis, questionAbout, signals,
} from "../lib/images";
import { dmy, fmt } from "../lib/format";

const IMG_ALT = (o: ImageObservation, point: string) => `${KIND_LABEL[o.kind]} de ${point}, ${dmy(o.observed_on)}`;

function AttentionChip({ analysis }: { analysis: ImageAnalysis }) {
  const att = attentionOf(analysis);
  return <span className="attention-chip" style={{ ["--c" as string]: att.color }}>{att.label}</span>;
}

/** Observação já confirmada: miniatura, resumo e, ao abrir, todos os detalhes. */
export function ObservationCard({ obs, pointName }: { obs: ImageObservation; pointName: string }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const a = obs.analysis;

  const remove = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    try {
      await deleteImage(obs.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir a observação.");
      setConfirming(false);
    }
  };

  return (
    <article className="obs-card">
      <button type="button" className="obs-thumb" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={`${open ? "Ocultar" : "Ver"} detalhes: ${IMG_ALT(obs, pointName)}`}>
        <img src={apiUrl(obs.file_url)} alt={IMG_ALT(obs, pointName)} loading="lazy" />
      </button>
      <div className="obs-body">
        <div className="obs-head">
          <span className="hn">{pointName}</span>
          <span className="obs-date">{dmy(obs.observed_on)}</span>
          <span className="obs-kind">{KIND_LABEL[obs.kind]}</span>
        </div>
        <AttentionChip analysis={a} />
        {a.resumo && <p className="obs-summary">{a.resumo}</p>}
        {signals(a).length > 0 && <ul className="signal-list">{signals(a).map((s) => <li key={s}>{s}</li>)}</ul>}
        <button type="button" className="text-button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "Ocultar detalhes" : "Ver detalhes"}
        </button>
        {open && (
          <div className="obs-details">
            {a.o_que_conferir_em_campo && <p><strong>O que conferir em campo:</strong> {a.o_que_conferir_em_campo}</p>}
            {obs.note && <p><strong>Sua observação:</strong> {obs.note}</p>}
            <MetricsTable metrics={obs.metrics} />
            <div className="obs-actions">
              <Link className="inline-link" to={`/assistente?pergunta=${encodeURIComponent(questionAbout(obs, pointName))}`}>Perguntar ao assistente</Link>
              <button type="button" className="text-button note-remove" onClick={remove} onBlur={() => setConfirming(false)}>
                {confirming ? "Confirmar exclusão" : "Excluir"}
              </button>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
          </div>
        )}
      </div>
    </article>
  );
}

function MetricsTable({ metrics }: { metrics: Record<string, number> }) {
  const rows = Object.entries(metrics).filter(([k]) => METRIC_LABEL[k]);
  if (!rows.length) return null;
  return (
    <details className="how">
      <summary>Indicadores de cor da imagem</summary>
      <div className="how-body">
        <p>Calculados a partir dos pixels. Servem para comparar imagens parecidas entre datas e pontos; não medem clorofila nem sedimentos.</p>
        <dl className="metric-list">
          {rows.map(([k, v]) => (
            <div key={k}><dt>{METRIC_LABEL[k]}</dt><dd>{fmt(v, Math.abs(v) < 2 ? 3 : 1)}</dd></div>
          ))}
        </dl>
      </div>
    </details>
  );
}

/** Observação pendente: a IA leu a imagem, e o biólogo confere e corrige cada campo antes de salvar. */
export function ReviewCard({ obs, pointName }: { obs: ImageObservation; pointName: string }) {
  const [a, setA] = useState<ImageAnalysis>(() => ({ ...blankAnalysis(obs.kind), ...obs.analysis }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const sat = obs.kind === "satelite";
  const set = <K extends keyof ImageAnalysis>(k: K, v: ImageAnalysis[K]) => setA((prev) => ({ ...prev, [k]: v }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await confirmImage(obs.id, a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a observação.");
      setSaving(false);
    }
  };

  const discard = async () => {
    if (!discarding) {
      setDiscarding(true);
      return;
    }
    try {
      await deleteImage(obs.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível descartar a imagem.");
      setDiscarding(false);
    }
  };

  return (
    <article className="review-card" aria-label={`Conferir ${IMG_ALT(obs, pointName)}`}>
      <div className="review-media">
        <img src={apiUrl(obs.file_url)} alt={IMG_ALT(obs, pointName)} />
        <p className="obs-head"><span className="hn">{pointName}</span><span className="obs-date">{dmy(obs.observed_on)}</span><span className="obs-kind">{KIND_LABEL[obs.kind]}</span></p>
        {obs.note && <p className="review-note">{obs.note}</p>}
        <MetricsTable metrics={obs.metrics} />
      </div>
      <form className="review-form" onSubmit={save}>
        {obs.analysis_error ? (
          <p className="llama-notice" role="note">{obs.analysis_error}</p>
        ) : (
          <p className="review-ai">A IA leu esta imagem com {fmt(obs.analysis.confianca * 100)}% de confiança. Confira cada campo: ela descreve só o que enxerga e não substitui o seu olhar de campo.</p>
        )}
        <div className="review-fields">
          <label className="note-field"><span>Cor da água</span>
            <input type="text" value={a.cor_da_agua} maxLength={80} onChange={(e) => set("cor_da_agua", e.target.value)} placeholder="Ex.: verde-escura" />
          </label>
          <label className="note-field"><span>Turbidez</span>
            <select value={a.turbidez} onChange={(e) => set("turbidez", e.target.value as ImageAnalysis["turbidez"])}>
              {TURBIDITY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="note-field"><span>Floração de algas</span>
            <select value={a.floracao_algas} onChange={(e) => set("floracao_algas", e.target.value as ImageAnalysis["floracao_algas"])}>
              {BLOOM.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          {sat ? (
            <>
              <label className="note-field"><span>Uso do entorno</span>
                <input type="text" value={a.uso_do_entorno ?? ""} maxLength={160} onChange={(e) => set("uso_do_entorno", e.target.value)} placeholder="Ex.: mata, lavoura, área urbana" />
              </label>
              <label className="note-field"><span>Mata ciliar</span>
                <select value={a.vegetacao_ribeirinha} onChange={(e) => set("vegetacao_ribeirinha", e.target.value as ImageAnalysis["vegetacao_ribeirinha"])}>
                  {RIPARIAN.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="note-field"><span>Vegetação aquática</span>
                <select value={a.vegetacao_aquatica} onChange={(e) => set("vegetacao_aquatica", e.target.value as ImageAnalysis["vegetacao_aquatica"])}>
                  {VEGETATION.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <fieldset className="check-group">
                <legend>O que aparece na água</legend>
                <label><input type="checkbox" checked={!!a.espuma} onChange={(e) => set("espuma", e.target.checked)} />Espuma</label>
                <label><input type="checkbox" checked={!!a.oleo_ou_filme} onChange={(e) => set("oleo_ou_filme", e.target.checked)} />Película de óleo</label>
                <label><input type="checkbox" checked={!!a.material_flutuante} onChange={(e) => set("material_flutuante", e.target.checked)} />Material flutuante</label>
              </fieldset>
            </>
          )}
        </div>
        <fieldset className="choice-group">
          <legend>Nível de atenção</legend>
          <div role="radiogroup" aria-label="Nível de atenção">
            {ATTENTION.map((o) => (
              <button
                key={o.level} type="button" role="radio" aria-checked={a.nivel_de_atencao === o.level}
                aria-pressed={a.nivel_de_atencao === o.level} onClick={() => set("nivel_de_atencao", o.level)}
                style={{ ["--c" as string]: o.color }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="note-field"><span>Resumo</span>
          <textarea rows={3} value={a.resumo} maxLength={600} onChange={(e) => set("resumo", e.target.value)} placeholder="O que a imagem mostra, em poucas frases" />
        </label>
        <label className="note-field"><span>O que conferir em campo</span>
          <textarea rows={2} value={a.o_que_conferir_em_campo} maxLength={400} onChange={(e) => set("o_que_conferir_em_campo", e.target.value)} placeholder="Ex.: medir oxigênio dissolvido e coletar água para fósforo" />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="review-actions">
          <button type="submit" className="button" disabled={saving}>{saving ? "Salvando…" : "Confirmar e salvar"}</button>
          <button type="button" className="text-button note-remove" onClick={discard} onBlur={() => setDiscarding(false)} disabled={saving}>
            {discarding ? "Confirmar descarte" : "Descartar imagem"}
          </button>
        </div>
      </form>
    </article>
  );
}

