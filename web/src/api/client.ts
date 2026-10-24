import useSWR, { mutate as globalMutate, useSWRConfig } from "swr";
import { useCallback, useEffect, useRef } from "react";
import type {
  AnalysisRun, AssistantMessage, DbSummary, FieldNote, ImageAnalysis, ImageObservation, ImportResult, NoteKind, Point, LlamaStatus, MonthlyRow, Overview, PipelineStatus, Series,
} from "./types";

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

/** Endereço completo de um caminho da API, para usar em <img src>. */
export const apiUrl = (path: string) => `${BASE}${path}`;

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Erro ${res.status}`, res.status);
  return body as T;
}

const swrOptions = { revalidateOnFocus: false, shouldRetryOnError: true, errorRetryInterval: 1500 };

export function useOverview() {
  return useSWR<Overview>("/api/overview", fetchJson, swrOptions);
}

/** Chaves que mudam a cada execução do pipeline (dados e análises no H2). */
const DB_KEYS = ["/api/db/summary", "/api/db/runs", "/api/db/monthly", "/api/assistant/history"];

export function useDbSummary() {
  return useSWR<DbSummary>("/api/db/summary", fetchJson, swrOptions);
}

export function useRuns() {
  return useSWR<AnalysisRun[]>("/api/db/runs", fetchJson, swrOptions);
}

export function useMonthly() {
  return useSWR<MonthlyRow[]>("/api/db/monthly", fetchJson, swrOptions);
}

export function useLlamaStatus() {
  return useSWR<LlamaStatus>("/api/assistant/status", fetchJson, { revalidateOnFocus: true });
}

export function useAssistantHistory() {
  return useSWR<AssistantMessage[]>("/api/assistant/history", fetchJson, swrOptions);
}

/** Envia os CSVs de dados reais; a API grava no H2 e dispara o pipeline. */
export function importData(form: FormData) {
  return fetchJson<ImportResult>("/api/data/import", { method: "POST", body: form });
}

export function askLlama(question: string) {
  return fetchJson<AssistantMessage>("/api/assistant/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
}

export async function clearAssistantHistory() {
  const res = await fetch(`${BASE}/api/assistant/history`, { method: "DELETE" });
  if (!res.ok) throw new ApiError(`Erro ${res.status}`, res.status);
}

/** Anotações do caderno de campo, de uma estação ou de todas. */
export function useNotes(stationId?: string) {
  const query = stationId ? `?station=${encodeURIComponent(stationId)}` : "";
  return useSWR<FieldNote[]>(`/api/notes${query}`, fetchJson, swrOptions);
}

const refreshNotes = () => globalMutate((key) => typeof key === "string" && key.startsWith("/api/notes"));

export async function addNote(note: { station_id: string; date: string; kind: NoteKind; text: string }) {
  const created = await fetchJson<FieldNote>("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(note),
  });
  await refreshNotes();
  return created;
}

export async function deleteNote(id: number) {
  const res = await fetch(`${BASE}/api/notes/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new ApiError(`Erro ${res.status}`, res.status);
  await refreshNotes();
}

/** Pontos de monitoramento criados a partir de imagens. */
export function usePoints() {
  return useSWR<Point[]>("/api/points", fetchJson, swrOptions);
}

/** Observações por imagem, da mais recente para a mais antiga; filtre por ponto e por situação. */
export function useImages(stationId?: string, status?: "pendente" | "confirmado") {
  const qs = new URLSearchParams();
  if (stationId) qs.set("station", stationId);
  if (status) qs.set("status", status);
  const query = qs.toString();
  return useSWR<ImageObservation[]>(`/api/images${query ? `?${query}` : ""}`, fetchJson, swrOptions);
}

const refreshImages = () => globalMutate((key) => typeof key === "string" && (key.startsWith("/api/images") || key === "/api/points"));

/** Envia a imagem; a API guarda, calcula os indicadores e pede a leitura à IA. */
export async function uploadImage(form: FormData) {
  const created = await fetchJson<ImageObservation>("/api/images", { method: "POST", body: form });
  await refreshImages();
  return created;
}

export async function confirmImage(id: number, analysis: ImageAnalysis) {
  const done = await fetchJson<ImageObservation>(`/api/images/${id}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(analysis),
  });
  await refreshImages();
  return done;
}

export async function deleteImage(id: number) {
  const res = await fetch(`${BASE}/api/images/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new ApiError(`Erro ${res.status}`, res.status);
  await refreshImages();
}

/** Apaga o conjunto de dados de sensores e as análises; imagens, anotações e conversas ficam. */
export async function clearSensorData() {
  const res = await fetch(`${BASE}/api/data`, { method: "DELETE" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Erro ${res.status}`, res.status);
  await globalMutate((key) => typeof key === "string" && key.startsWith("/api/"), undefined, { revalidate: true });
}

export function useSeries(stationId: string | undefined) {
  return useSWR<Series>(stationId ? `/api/stations/${encodeURIComponent(stationId)}/series` : null, fetchJson, swrOptions);
}

/**
 * Acompanha o pipeline. Consulta rápido enquanto ele roda e, quando termina,
 * revalida a visão geral e os dados do H2 e descarta as séries em cache.
 */
export function usePipeline() {
  const { mutate } = useSWRConfig();
  const status = useSWR<PipelineStatus>("/api/pipeline/status", fetchJson, {
    revalidateOnFocus: false,
    refreshInterval: (data) => (data?.running ? 900 : 0),
  });
  const wasRunning = useRef(false);

  useEffect(() => {
    const running = !!status.data?.running;
    if (wasRunning.current && !running) {
      mutate("/api/overview");
      DB_KEYS.forEach((k) => mutate(k));
      mutate((key) => typeof key === "string" && key.endsWith("/series"), undefined, { revalidate: true });
    }
    wasRunning.current = running;
  }, [status.data?.running, mutate]);

  const run = useCallback(async () => {
    const next = await fetchJson<PipelineStatus>("/api/pipeline/run", { method: "POST" });
    await status.mutate(next, { revalidate: false });
  }, [status]);

  /** Passa a acompanhar uma execução iniciada por outra rota (ex.: importação). */
  const follow = useCallback((next: PipelineStatus) => status.mutate(next, { revalidate: true }), [status]);

  return { ...status, run, follow };
}
