import { describe, expect, it } from "vitest";
import {
  parseFechaUsuario,
  parseMontoUsuario,
  parseNumeroUsuario,
  parsePeriodoUsuario,
} from "../src/core/flows/validadores.js";

describe("parseFechaUsuario", () => {
  it("acepta DD/MM/AAAA", () => {
    expect(parseFechaUsuario("01/08/2026")).toBe("2026-08-01");
  });

  it("acepta DD-MM-AAAA", () => {
    expect(parseFechaUsuario("1-8-2026")).toBe("2026-08-01");
  });

  it("acepta YYYY-MM-DD", () => {
    expect(parseFechaUsuario("2026-08-01")).toBe("2026-08-01");
  });

  it('acepta "hoy"', () => {
    expect(parseFechaUsuario("hoy")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("rechaza fechas inválidas (día/mes fuera de rango)", () => {
    expect(parseFechaUsuario("32/01/2026")).toBeNull();
    expect(parseFechaUsuario("15/13/2026")).toBeNull();
  });

  it("rechaza fechas que no existen (31 de febrero)", () => {
    expect(parseFechaUsuario("31/02/2026")).toBeNull();
  });

  it("rechaza texto que no es una fecha", () => {
    expect(parseFechaUsuario("¿qué contratos vencen?")).toBeNull();
  });
});

describe("parseMontoUsuario", () => {
  it("acepta un número simple", () => {
    expect(parseMontoUsuario("850000")).toBe("850000");
  });

  it("acepta el símbolo $ y separador de miles", () => {
    expect(parseMontoUsuario("$850.000")).toBe("850000");
  });

  it("acepta decimales con coma", () => {
    expect(parseMontoUsuario("850000,50")).toBe("850000.50");
  });

  it("rechaza cero o negativos", () => {
    expect(parseMontoUsuario("0")).toBeNull();
    expect(parseMontoUsuario("-100")).toBeNull();
  });

  it("rechaza texto que no es un monto", () => {
    expect(parseMontoUsuario("mostrame mis propiedades")).toBeNull();
  });
});

describe("parsePeriodoUsuario", () => {
  it("acepta MM/AAAA", () => {
    expect(parsePeriodoUsuario("08/2026")).toBe("2026-08");
  });

  it("acepta YYYY-MM", () => {
    expect(parsePeriodoUsuario("2026-08")).toBe("2026-08");
  });

  it("rechaza mes fuera de rango", () => {
    expect(parsePeriodoUsuario("13/2026")).toBeNull();
  });

  it("rechaza texto libre", () => {
    expect(parsePeriodoUsuario("el mes que viene")).toBeNull();
  });
});

describe("parseNumeroUsuario", () => {
  it("acepta un entero dentro del rango", () => {
    expect(parseNumeroUsuario("15", 1, 28)).toBe(15);
  });

  it("rechaza fuera de rango", () => {
    expect(parseNumeroUsuario("30", 1, 28)).toBeNull();
    expect(parseNumeroUsuario("0", 1, 28)).toBeNull();
  });

  it("rechaza no-enteros y texto", () => {
    expect(parseNumeroUsuario("10.5")).toBeNull();
    expect(parseNumeroUsuario("quince")).toBeNull();
  });
});
