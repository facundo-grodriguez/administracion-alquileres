import { describe, expect, it } from "vitest";
import { esCallbackAccion, parseCallbackAccion } from "../src/interfaces/telegram/acciones.js";
import {
  construirInlineKeyboard,
  datosConReferencia,
  textoParaCallback,
} from "../src/interfaces/telegram/keyboards.js";

const UUID = "8f1c2a4e-0000-4000-8000-000000000000";

function botones(teclado: ReturnType<typeof construirInlineKeyboard>): string[] {
  return teclado.inline_keyboard.flat().map((b) => ("callback_data" in b ? (b.callback_data ?? "") : ""));
}

describe("botones de acción", () => {
  it("llevan el contrato o la propiedad cuando se sabe cuál es", () => {
    expect(datosConReferencia("accion:registrar_pago", { contratoId: UUID })).toBe(`accion:registrar_pago:c:${UUID}`);
    expect(datosConReferencia("accion:agregar_gasto", { propiedadId: UUID })).toBe(`accion:agregar_gasto:p:${UUID}`);
    expect(datosConReferencia("accion:ver_propiedad", { contratoId: UUID })).toBe(`accion:ver_propiedad:c:${UUID}`);
    expect(datosConReferencia("accion:registrar_pago")).toBe("accion:registrar_pago");
    expect(datosConReferencia("nav:menu", { contratoId: UUID })).toBe("nav:menu");
  });

  it("ningún botón con referencia pasa los 64 bytes de Telegram", () => {
    const contextos = [
      "propiedad_detalle",
      "contrato_detalle",
      "post_propiedad",
      "post_contrato",
      "post_pago",
      "post_gasto",
    ] as const;
    for (const c of contextos) {
      for (const d of botones(construirInlineKeyboard(c, { contratoId: UUID, propiedadId: UUID }))) {
        expect(new TextEncoder().encode(d).length).toBeLessThanOrEqual(64);
      }
    }
  });

  it("las acciones ya no se mandan como texto a la IA", () => {
    const contextos = [
      "propiedad_detalle",
      "contrato_detalle",
      "post_propiedad",
      "post_contrato",
      "post_pago",
      "post_gasto",
    ] as const;
    for (const c of contextos) {
      for (const d of botones(construirInlineKeyboard(c))) {
        if (esCallbackAccion(d)) expect(textoParaCallback(d)).toBeUndefined();
      }
    }
  });

  it("parsea la referencia del callback", () => {
    expect(parseCallbackAccion(`accion:ver_contrato:c:${UUID}`)).toEqual({
      accion: "ver_contrato",
      referencia: { contratoId: UUID },
    });
    expect(parseCallbackAccion("accion:otro_gasto")).toEqual({ accion: "otro_gasto", referencia: {} });
  });
});
