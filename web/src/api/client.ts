import useSWR, { useSWRConfig } from "swr";
import { useCallback, useEffect, useRef } from "react";
import type { Overview, PipelineStatus, Series } from "./types";

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

export function useSeries(stationId: string | undefined) {
  return useSWR<Series>(stationId ? `/api/stations/${encodeURIComponent(stationId)}/series` : null, fetchJson, swrOptions);
}

/**
 * Acompanha o pipeline. Consulta rápido enquanto ele roda e, quando termina,
 * revalida a visão geral e descarta as séries em cache.
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

  return { ...status, run };
}
