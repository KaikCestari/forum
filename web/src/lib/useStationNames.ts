import { useMemo } from "react";
import { useOverview, usePoints } from "../api/client";

/** Nome legível de cada ponto de imagens e de cada estação de sensores, por código. */
export function useStationNames(): Map<string, string> {
  const stations = useOverview().data?.stations;
  const points = usePoints().data;
  return useMemo(() => {
    const names = new Map<string, string>();
    stations?.forEach((s) => names.set(s.id, s.name));
    points?.forEach((p) => names.set(p.id, p.name));
    return names;
  }, [stations, points]);
}
