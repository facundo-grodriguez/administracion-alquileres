import { describe, expect, it } from "vitest";
import {
  crearVencimientoServicioFlow,
  editarVencimientoServicioFlow,
} from "../src/core/flows/definiciones/serviciosVencimiento.flow.js";
import { esCallbackServicio, parseCallbackServicio, tecladoAviso } from "../src/interfaces/telegram/avisosServicios.js";

const ID = "8f1c2a4e-0000-4000-8000-000000000000";

describe("botones del aviso de vencimiento", () => {
  it("ofrece marcar pagado o cambiar la fecha de ese mes", () => {
    const teclado = tecladoAviso({ servicioId: ID, periodo: "2026-11" });
    const botones = teclado.inline_keyboard.flat().map((b) => [b.text, "callback_data" in b ? b.callback_data : ""]);
    expect(botones).toEqual([
      ["✅ Ya lo pagué", `sv:pag:${ID}:2026-11`],
      ["📅 Cambió la fecha", `sv:fec:${ID}:2026-11`],
    ]);
  });

  it("los callbacks entran en los 64 bytes de Telegram y se parsean", () => {
    for (const b of tecladoAviso({ servicioId: ID, periodo: "2026-11" }).inline_keyboard.flat()) {
      expect(("callback_data" in b ? b.callback_data! : "").length).toBeLessThanOrEqual(64);
    }
    expect(esCallbackServicio(`sv:pag:${ID}:2026-11`)).toBe(true);
    expect(esCallbackServicio("cq:serv")).toBe(false);
    expect(parseCallbackServicio(`sv:fec:${ID}:2026-11`)).toEqual({
      accion: "fec",
      servicioId: ID,
      periodo: "2026-11",
    });
  });
});

const paso = (flujo: typeof crearVencimientoServicioFlow, id: string) => flujo.pasos.find((p) => p.id === id)!;

describe("flujo de alta de vencimiento", () => {
  it("la propiedad solo se pregunta si es de una propiedad", () => {
    const propiedad = paso(crearVencimientoServicioFlow, "propiedad_id");
    expect(propiedad.saltar?.({ de_quien: "personal" })).toBe(true);
    expect(propiedad.saltar?.({ de_quien: "propiedad" })).toBe(false);
  });

  it("el nombre solo se pide si el servicio es 'Otro'", () => {
    const nombre = paso(crearVencimientoServicioFlow, "nombre_otro");
    expect(nombre.saltar?.({ servicio: "Luz" })).toBe(true);
    expect(nombre.saltar?.({ servicio: "otro" })).toBe(false);
  });

  it("el día va de 1 a 31 y la confirmación resume todo", () => {
    expect(paso(crearVencimientoServicioFlow, "dia").campo).toEqual({ tipo: "numero", min: 1, max: 31 });
    const texto = paso(crearVencimientoServicioFlow, "__confirmar").pregunta({
      de_quien: "personal",
      servicio: "Luz",
      dia: 15,
      monto: "12000",
    });
    expect(texto).toContain("⚡ Luz (Personal)");
    expect(texto).toContain("día 15 de cada mes");
    expect(texto).toContain("3 días antes");
  });
});

describe("flujo de modificar vencimiento", () => {
  it("desde el aviso va directo a la fecha, nombrando el mes", () => {
    const fecha = paso(editarVencimientoServicioFlow, "fecha");
    expect(fecha.saltar?.({ accion: "fecha_este_mes" })).toBe(false);
    expect(fecha.saltar?.({ accion: "baja" })).toBe(true);
    expect(fecha.pregunta({ accion: "fecha_este_mes", periodo: "2026-11" })).toContain("Noviembre 2026");
  });

  it("cada opción pide solo su dato", () => {
    expect(paso(editarVencimientoServicioFlow, "dia").saltar?.({ accion: "dia_fijo" })).toBe(false);
    expect(paso(editarVencimientoServicioFlow, "dia").saltar?.({ accion: "monto" })).toBe(true);
    expect(paso(editarVencimientoServicioFlow, "monto").saltar?.({ accion: "monto" })).toBe(false);
    expect(paso(editarVencimientoServicioFlow, "monto").saltar?.({ accion: "baja" })).toBe(true);
  });
});
