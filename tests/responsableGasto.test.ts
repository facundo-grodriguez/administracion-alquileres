import { describe, expect, it } from "vitest";
import { TIPOS_GASTO } from "../src/core/flows/definiciones/crearGasto.flow.js";
import { entraEnBalance, hayQueElegirResponsable, responsablePorDefecto } from "../src/core/util/responsableGasto.js";

describe("quién paga cada gasto", () => {
  it("servicios, expensas, impuestos y seguro los paga el inquilino", () => {
    for (const tipo of ["luz", "gas", "agua", "internet", "expensas", "ABL", "ARBA", "seguro_hogar"]) {
      expect(hayQueElegirResponsable(tipo)).toBe(false);
      expect(responsablePorDefecto(tipo)).toBe("inquilino");
    }
  });

  it("arreglos y otro se detallan", () => {
    expect(hayQueElegirResponsable("reparacion")).toBe(true);
    expect(hayQueElegirResponsable("otro")).toBe(true);
    expect(responsablePorDefecto("reparacion")).toBeUndefined();
  });

  it("todo tipo ofrecido tiene una regla", () => {
    for (const t of TIPOS_GASTO) {
      expect(hayQueElegirResponsable(t.valor) || responsablePorDefecto(t.valor) === "inquilino").toBe(true);
    }
  });

  it("solo resta en el balance lo que no paga el inquilino", () => {
    expect(entraEnBalance({ responsable: "inquilino" })).toBe(false);
    expect(entraEnBalance({ responsable: "propietario" })).toBe(true);
    expect(entraEnBalance({ responsable: null })).toBe(true);
  });
});
