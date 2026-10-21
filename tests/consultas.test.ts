import { describe, expect, it } from "vitest";
import {
  esCallbackConsulta,
  OPCIONES_CONSULTA,
  parseCallbackConsulta,
  rangoBalance,
  tecladoConsultas,
} from "../src/interfaces/telegram/consultas.js";

function botones(teclado: ReturnType<typeof tecladoConsultas>): string[] {
  return teclado.inline_keyboard.flat().map((b) => ("callback_data" in b ? b.callback_data : ""));
}

describe("menú de Consultas", () => {
  it("ofrece un botón por cada consulta", () => {
    expect(botones(tecladoConsultas())).toEqual(OPCIONES_CONSULTA.map((o) => `cq:${o.op}`));
  });

  it("reconoce y parsea sus callbacks", () => {
    expect(esCallbackConsulta("cq:hist")).toBe(true);
    expect(esCallbackConsulta("flujo:iniciar:crear_recibo")).toBe(false);
    expect(parseCallbackConsulta("cq:hist:8f1c2a4e-0000-4000-8000-000000000000")).toEqual({
      op: "hist",
      contratoId: "8f1c2a4e-0000-4000-8000-000000000000",
    });
    expect(parseCallbackConsulta("cq:deudas")).toEqual({ op: "deudas", contratoId: undefined, extra: undefined });
  });

  it("el callback con un id de contrato entra en el límite de 64 bytes de Telegram", () => {
    const masLargo = Math.max(...OPCIONES_CONSULTA.map((o) => o.op.length));
    expect(`cq:${"x".repeat(masLargo)}:${"0".repeat(36)}`.length).toBeLessThanOrEqual(64);
  });
});

describe("rangoBalance", () => {
  it("este mes, mes anterior y este año", () => {
    expect(rangoBalance("mes", "2026-10-21")).toEqual({ desde: "2026-10-01", hasta: "2026-10-21" });
    expect(rangoBalance("mesant", "2026-10-21")).toEqual({ desde: "2026-09-01", hasta: "2026-09-30" });
    expect(rangoBalance("mesant", "2026-01-15")).toEqual({ desde: "2025-12-01", hasta: "2025-12-31" });
    expect(rangoBalance("anio", "2026-10-21")).toEqual({ desde: "2026-01-01", hasta: "2026-10-21" });
  });
  it("el callback de balance por propiedad entra en 64 bytes", () => {
    expect(`cq:bal:${"0".repeat(36)}:mesant`.length).toBeLessThanOrEqual(64);
    expect(parseCallbackConsulta("cq:bal:todas:mes")).toEqual({ op: "bal", contratoId: "todas", extra: "mes" });
  });
});
