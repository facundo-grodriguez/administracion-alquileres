import { describe, expect, it } from "vitest";
import { diasEntreISO, hoyISO, sumarDiasISO } from "../src/core/util/fecha.js";

describe("hoyISO", () => {
  it("devuelve una fecha en formato YYYY-MM-DD", () => {
    expect(hoyISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("sumarDiasISO", () => {
  it("suma días dentro del mismo mes", () => {
    expect(sumarDiasISO("2026-07-01", 10)).toBe("2026-07-11");
  });

  it("cruza el límite de mes", () => {
    expect(sumarDiasISO("2026-07-25", 10)).toBe("2026-08-04");
  });

  it("cruza el límite de año", () => {
    expect(sumarDiasISO("2026-12-28", 10)).toBe("2027-01-07");
  });

  it("resta días con valores negativos", () => {
    expect(sumarDiasISO("2026-07-10", -15)).toBe("2026-06-25");
  });
});

describe("diasEntreISO", () => {
  it("cuenta los días que faltan (positivo)", () => {
    expect(diasEntreISO("2026-07-01", "2026-07-11")).toBe(10);
  });

  it("devuelve negativo si la fecha ya pasó", () => {
    expect(diasEntreISO("2026-07-11", "2026-07-01")).toBe(-10);
  });

  it("devuelve 0 para el mismo día", () => {
    expect(diasEntreISO("2026-07-11", "2026-07-11")).toBe(0);
  });

  it("cruza límites de mes y año", () => {
    expect(diasEntreISO("2026-12-28", "2027-01-07")).toBe(10);
  });
});
