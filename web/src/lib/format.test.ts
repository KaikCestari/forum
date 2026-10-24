import { describe, expect, it } from "vitest";
import { shortPaths } from "./format";

describe("shortPaths", () => {
  it("troca caminhos absolutos pelo último trecho", () => {
    expect(shortPaths("105120 leituras → /home/ana/orca/forum/data/raw")).toBe("105120 leituras → raw");
    expect(shortPaths("gravado em /srv/aquaml/data/results/results.json em 3s")).toBe("gravado em results.json em 3s");
  });

  it("não mexe em datas nem em frações", () => {
    expect(shortPaths("de 15/01/2025 a 01/02/2025")).toBe("de 15/01/2025 a 01/02/2025");
    expect(shortPaths("razão 3/4 e 10/12")).toBe("razão 3/4 e 10/12");
  });
});
