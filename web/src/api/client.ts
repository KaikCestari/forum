import useSWR, { useSWRConfig } from "swr";
import { useCallback, useEffect, useRef } from "react";
import type {
  AnalysisRun, AssistantMessage, DbSummary, ImportResult, LlamaStatus, MonthlyRow, Overview, PipelineStatus, Series,
} from "./types";

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

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

  const run = useCallback(async (regenerate: boolean, seed: string) => {
    const qs = new URLSearchParams({ regenerate: String(regenerate) });
    if (seed.trim()) qs.set("seed", seed.trim());
    const next = await fetchJson<PipelineStatus>(`/api/pipeline/run?${qs}`, { method: "POST" });
    await status.mutate(next, { revalidate: false });
  }, [status]);

  /** Passa a acompanhar uma execução iniciada por outra rota (ex.: importação). */
  const follow = useCallback((next: PipelineStatus) => status.mutate(next, { revalidate: true }), [status]);

  return { ...status, run, follow };
}
