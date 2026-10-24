import { m } from "motion/react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { uploadImage, useImages, useOverview, usePoints } from "../api/client";
import type { ImageKind, StationType } from "../api/types";
import {
  ObservationCard,
  ReviewCard,
} from "../components/ImageObservationCard";
import { KIND_LABEL } from "../lib/images";
import { STATION_TYPE_LABEL } from "../lib/guide";
import { useStationNames } from "../lib/useStationNames";
import { tap } from "../motion/tokens";

const NEW_POINT = "__novo__";
const today = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);

export default function ImagesView() {
  const [params, setParams] = useSearchParams();
  const tab = ["enviar", "revisar", "confirmadas"].includes(
    params.get("aba") ?? "",
  )
    ? params.get("aba")!
    : "enviar";
  const names = useStationNames();
  const pending = useImages(undefined, "pendente").data ?? [];
  const [filter, setFilter] = useState("");
  const confirmed = useImages(filter || undefined, "confirmado").data ?? [];
  const allConfirmed = useImages(undefined, "confirmado").data ?? [];
  const reviewRef = useRef<HTMLElement>(null);

  // Só oferece no filtro os pontos que já têm observações confirmadas.
  const withImages = useMemo(
    () => [...new Set(allConfirmed.map((o) => o.station_id))],
    [allConfirmed],
  );

  return (
    <article className="images">
      <header className="images-intro">
        <h1>Imagens</h1>
        <p className="lede">
          Envie uma foto da água ou uma imagem de satélite. A IA descreve o que
          enxerga e você confere cada campo antes de salvar.
        </p>
      </header>

      <nav className="section-tabs" aria-label="Etapas das imagens">
        {[
          { id: "enviar", label: "Enviar imagem" },
          { id: "revisar", label: "Para conferir", count: pending.length },
          {
            id: "confirmadas",
            label: "Confirmadas",
            count: allConfirmed.length,
          },
        ].map((t) => (
          <button
            type="button"
            key={t.id}
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() =>
              setParams((previous) => {
                const next = new URLSearchParams(previous);
                next.set("aba", t.id);
                return next;
              })
            }
          >
            {t.label}
            {t.count !== undefined && <span>{t.count}</span>}
          </button>
        ))}
      </nav>

      {tab === "enviar" && (
        <>
          <UploadPanel
            initialPoint={params.get("ponto") ?? ""}
            onSent={() => setParams({ aba: "revisar" })}
          />
          {pending.length > 0 && (
            <p className="workflow-notice">
              Você tem {pending.length}{" "}
              {pending.length === 1
                ? "imagem para conferir"
                : "imagens para conferir"}
              .{" "}
              <button
                type="button"
                className="text-button"
                onClick={() => setParams({ aba: "revisar" })}
              >
                Abrir revisão
              </button>
            </p>
          )}
        </>
      )}

      {tab === "revisar" && (
        <section
          ref={reviewRef}
          className="images-block"
          aria-labelledby="pending-title"
        >
          <h2 id="pending-title">Para conferir ({pending.length})</h2>
          <p className="block-intro">
            Estas imagens ainda não fazem parte dos seus dados. Corrija o que
            for preciso e confirme.
          </p>
          <div className="review-list">
            {pending.map((o) => (
              <ReviewCard
                key={o.id}
                obs={o}
                pointName={names.get(o.station_id) ?? o.station_id}
              />
            ))}
          </div>
          {!pending.length && (
            <div className="feature-empty">
              <h2>Nenhuma imagem para conferir</h2>
              <p>
                As novas imagens aparecem aqui depois da análise. Revise os
                campos antes de confirmar.
              </p>
              <button
                className="button"
                type="button"
                onClick={() => setParams({ aba: "enviar" })}
              >
                Enviar imagem
              </button>
            </div>
          )}
        </section>
      )}

      {tab === "confirmadas" && (
        <section className="images-block" aria-labelledby="done-title">
          <div className="block-head">
            <h2 id="done-title">Observações confirmadas</h2>
            {withImages.length > 1 && (
              <label className="note-field images-filter">
                <span className="visually-hidden">Filtrar por ponto</span>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  aria-label="Filtrar por ponto"
                >
                  <option value="">Todos os pontos</option>
                  {withImages.map((id) => (
                    <option key={id} value={id}>
                      {names.get(id) ?? id}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {confirmed.length ? (
            <m.div className="obs-grid" layout>
              {confirmed.map((o) => (
                <ObservationCard
                  key={o.id}
                  obs={o}
                  pointName={names.get(o.station_id) ?? o.station_id}
                />
              ))}
            </m.div>
          ) : (
            <p className="empty">
              {allConfirmed.length
                ? "Nenhuma observação confirmada para este ponto."
                : "Nenhuma observação confirmada ainda. Envie uma imagem na aba Enviar imagem e confira o resultado."}
            </p>
          )}
        </section>
      )}
    </article>
  );
}

function UploadPanel({
  initialPoint,
  onSent,
}: {
  initialPoint: string;
  onSent: () => void;
}) {
  const points = usePoints().data ?? [];
  const stations = useOverview().data?.stations ?? [];
  const [kind, setKind] = useState<ImageKind>("foto");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [point, setPoint] = useState(initialPoint);
  const [name, setName] = useState("");
  const [type, setType] = useState<StationType>("rio");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const noPoints = points.length === 0 && stations.length === 0;
  const choice = point || (noPoints ? NEW_POINT : "");
  const creating = choice === NEW_POINT;

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const ready =
    !!file &&
    !!date &&
    !!choice &&
    (!creating || (name.trim() !== "" && !!type));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !ready || sending) return;
    const fd = new FormData();
    fd.set("image", file);
    fd.set("kind", kind);
    fd.set("date", date);
    if (creating) {
      fd.set("point_name", name.trim());
      fd.set("point_type", type);
      if (lat.trim()) fd.set("point_lat", lat.trim());
      if (lon.trim()) fd.set("point_lon", lon.trim());
    } else {
      fd.set("station_id", choice);
    }
    if (note.trim()) fd.set("note", note.trim());
    setSending(true);
    setError(null);
    try {
      const created = await uploadImage(fd);
      setFile(null);
      setNote("");
      setName("");
      setLat("");
      setLon("");
      setPoint(created.station_id);
      if (input.current) input.current.value = "";
      onSent();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível enviar a imagem.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="upload-panel" aria-labelledby="upload-title">
      <h2 id="upload-title">Enviar uma imagem</h2>
      <form onSubmit={submit} className="upload-form">
        <fieldset className="choice-group kind-group">
          <legend>O que você vai enviar</legend>
          <div role="radiogroup" aria-label="Tipo de imagem">
            {(Object.keys(KIND_LABEL) as ImageKind[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <p className="field-hint">
            {kind === "foto"
              ? "Foto tirada no local: a IA descreve a cor da água, a turbidez e sinais como espuma, óleo ou floração de algas."
              : "Imagem vista de cima: a IA aponta cor da água, possível floração e o uso do entorno. Com imagem comum, os indicadores são aproximados."}
          </p>
        </fieldset>

        <label className={`dropzone ${file ? "has-file" : ""}`}>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {preview ? (
            <img src={preview} alt="Prévia da imagem escolhida" />
          ) : (
            <span className="dropzone-text">
              <strong>Escolha a imagem</strong>
              <span>JPG ou PNG, até 12 MB</span>
            </span>
          )}
          {file && <span className="dropzone-name">{file.name}</span>}
        </label>

        <div className="upload-fields">
          <label className="note-field">
            <span>Data da imagem</span>
            <input
              type="date"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label className="note-field">
            <span>Ponto de monitoramento</span>
            <select
              aria-label="Ponto de monitoramento"
              value={choice}
              onChange={(e) => setPoint(e.target.value)}
              required
            >
              <option value="" disabled>
                Escolha um ponto
              </option>
              {points.length > 0 && (
                <optgroup label="Pontos de imagens">
                  {points.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {stations.length > 0 && (
                <optgroup label="Estações com sensores">
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <option value={NEW_POINT}>Novo ponto…</option>
            </select>
          </label>
        </div>

        {creating && (
          <div className="upload-fields new-point">
            <label className="note-field">
              <span>Nome do novo ponto</span>
              <input
                type="text"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Lagoa do Parque, margem norte"
              />
            </label>
            <label className="note-field">
              <span>Tipo</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as StationType)}
              >
                {Object.entries(STATION_TYPE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="note-field">
              <span>
                Latitude <em>opcional</em>
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="-22,90"
              />
            </label>
            <label className="note-field">
              <span>
                Longitude <em>opcional</em>
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                placeholder="-47,06"
              />
            </label>
          </div>
        )}

        <label className="note-field">
          <span>
            Observação <em>opcional</em>
          </span>
          <textarea
            rows={2}
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: margem esquerda, cerca de 50 m da ponte"
          />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="upload-actions">
          <m.button
            type="submit"
            className="button"
            disabled={!ready || sending}
            whileTap={tap}
          >
            {sending ? "Analisando a imagem…" : "Analisar imagem"}
          </m.button>
          <p className="field-hint" role="status">
            {sending
              ? "A IA leva de 10 a 40 segundos para ler a imagem."
              : "A IA lê a imagem e você confere antes de salvar."}
          </p>
        </div>
      </form>
    </section>
  );
}
