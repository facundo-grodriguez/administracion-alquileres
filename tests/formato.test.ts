import { describe, expect, it } from "vitest";
import { formatoARS } from "../src/core/util/formato.js";

// El espaciado entre el símbolo y el número depende de la versión de ICU del runtime,
// así que normalizamos los espacios (incluido el no-break space) antes de comparar.
const normalizar = (s: string) => s.replace(/\s+/g, " ").trim();

describe("formatoARS", () => {
  it("formatea un string numérico como pesos argentinos", () => {
    expect(normalizar(formatoARS("150000"))).toMatch(/^\$\s?150\.000$/);
  });

  it("formatea un número", () => {
    expect(normalizar(formatoARS(1500))).toMatch(/^\$\s?1\.500$/);
  });

  it("devuelve un placeholder cuando el monto es null o undefined", () => {
    expect(formatoARS(null)).toBe("(sin monto)");
    expect(formatoARS(undefined)).toBe("(sin monto)");
  });

  it("devuelve el valor original si no se puede parsear como número", () => {
    expect(formatoARS("no-es-un-numero")).toBe("no-es-un-numero");
  });
});
