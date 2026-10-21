import { describe, expect, it } from "vitest";
import { tipoGastoEnum } from "../src/core/db/schema.js";
import { TIPOS_GASTO } from "../src/core/flows/definiciones/crearGasto.flow.js";

describe("tipos de gasto", () => {
  it("ofrece arreglo/reparación y solo el seguro hogar", () => {
    const valores = TIPOS_GASTO.map((t) => t.valor);
    expect(valores).toContain("reparacion");
    expect(valores).toContain("seguro_hogar");
    expect(valores).not.toContain("seguro_incendio");
  });

  it("todo lo que se ofrece existe en la base", () => {
    for (const t of TIPOS_GASTO) expect(tipoGastoEnum.enumValues).toContain(t.valor);
  });
});
