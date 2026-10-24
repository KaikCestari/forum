import { AnimatePresence, m } from "motion/react";
import { useState, type FormEvent } from "react";
import { addNote, deleteNote, useNotes } from "../api/client";
import type { NoteKind, Station } from "../api/types";
import { dmy } from "../lib/format";
import { tap } from "../motion/tokens";

export const NOTE_KIND: Record<NoteKind, string> = {
  observacao: "Observação",
  coleta: "Coleta",
  ocorrencia: "Ocorrência",
  manejo: "Manejo",
};

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

/** Caderno de campo da estação: o que a equipe viu, coletou ou fez, junto dos números. */
export function NotesPanel({ station }: { station: Pick<Station, "id" | "name"> }) {
  const notes = useNotes(station.id).data ?? [];
  const [date, setDate] = useState(today);
  const [kind, setKind] = useState<NoteKind>("observacao");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await addNote({ station_id: station.id, date, kind, text: text.trim() });
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a anotação.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (confirming !== id) {
      setConfirming(id);
      return;
    }
    setConfirming(null);
    try {
      await deleteNote(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir a anotação.");
    }
  };

  return (
    <section className="notes" aria-labelledby="notes-title">
      <div className="block-head">
        <h2 id="notes-title">Caderno de campo</h2>
        <p>Registre observações de {station.name}. O assistente consulta as anotações ao responder.</p>
      </div>
      <form className="note-form" onSubmit={submit}>
        <label className="note-field">
          <span>Data</span>
          <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="note-field">
          <span>Tipo</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as NoteKind)}>
            {(Object.keys(NOTE_KIND) as NoteKind[]).map((k) => <option key={k} value={k}>{NOTE_KIND[k]}</option>)}
          </select>
        </label>
        <label className="note-field note-text">
          <span>O que você observou</span>
          <textarea
            value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000} required
            placeholder="Ex.: espuma branca na margem esquerda e cheiro de esgoto perto da ponte"
          />
        </label>
        <m.button type="submit" className="button" disabled={saving || !text.trim()} whileTap={tap}>
          {saving ? "Salvando…" : "Salvar anotação"}
        </m.button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
      {notes.length ? (
        <ul className="note-list">
          <AnimatePresence initial={false}>
            {notes.map((n) => (
              <m.li key={n.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <span className={`note-kind is-${n.kind}`}>{NOTE_KIND[n.kind] ?? n.kind}</span>
                <span className="note-date">{dmy(n.noted_on)}</span>
                <p>{n.text}</p>
                <button type="button" className="text-button note-remove" onClick={() => remove(n.id)} onBlur={() => setConfirming(null)}>
                  {confirming === n.id ? "Confirmar exclusão" : "Excluir"}
                </button>
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <p className="empty">Nenhuma anotação para esta estação. Escreva a primeira acima.</p>
      )}
    </section>
  );
}
