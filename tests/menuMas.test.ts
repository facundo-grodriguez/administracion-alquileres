import { describe, expect, it, vi } from "vitest";

vi.mock("../src/interfaces/telegram/menuDirecto.js", () => ({
  listarPropiedadesTexto: async () => "propiedades",
  listarContratosVigentesTexto: async () => "contratos",
}));
vi.mock("../src/core/planilla/sincronizarPlanilla.js", () => ({
  configPlanilla: () => undefined,
  linkDePlanilla: () => "",
}));

const { FLUJOS } = await import("../src/core/flows/definiciones/index.js");
const { OPCIONES_CONSULTA } = await import("../src/interfaces/telegram/consultas.js");
const { responderMas, tecladoMas } = await import("../src/interfaces/telegram/menuMas.js");
const { menuPrincipalKeyboard, MENU } = await import("../src/interfaces/telegram/keyboards.js");

import type { InlineKeyboard } from "grammy";

const datos = (t: InlineKeyboard) => t.inline_keyboard.flat().map((b) => ("callback_data" in b ? b.callback_data : ""));

describe("teclado fijo y ⚙️ Más (v9.14.0)", () => {
  it("el teclado fijo tiene lo de todos los días", () => {
    const textos = menuPrincipalKeyboard.keyboard.flat().map((b) => (typeof b === "string" ? b : b.text));
    expect(textos).toEqual([MENU.hoy, MENU.pagar, MENU.cuentas, MENU.corregir, MENU.cobro, MENU.mas]);
  });

  it("Más abre los temas", () => {
    expect(datos(tecladoMas())).toEqual(["mas:alq", "mas:gas", "mas:altas", "cq:menu"]);
  });

  it("cada botón de cada tema apunta a una consulta o un flujo que existe", async () => {
    const ops = new Set(OPCIONES_CONSULTA.map((o) => o.op));
    for (const tema of ["alq", "gas", "altas"]) {
      const { teclado } = await responderMas(`mas:${tema}`);
      for (const d of datos(teclado)) {
        if (d.startsWith("cq:")) expect(ops.has(d.slice(3))).toBe(true);
        else if (d.startsWith("flujo:iniciar:")) expect(FLUJOS).toHaveProperty(d.slice("flujo:iniciar:".length));
        else expect(["mas:prop", "mas:contr", "mas:menu"]).toContain(d);
      }
    }
    expect((await responderMas("mas:prop")).texto).toBe("propiedades");
  });
});
