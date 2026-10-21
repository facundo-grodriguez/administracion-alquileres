import { describe, expect, it } from "vitest";
import type { ResultadoFlujo } from "../src/core/flows/types.js";
import {
  esCallbackFlujo,
  parseCallbackFlujo,
  renderResultado,
  tecladoModificar,
  tecladoNuevaCarga,
} from "../src/interfaces/telegram/flowKeyboards.js";

function botones(teclado: { inline_keyboard: { text: string; callback_data?: string }[][] } | undefined): string[] {
  if (!teclado) return [];
  return teclado.inline_keyboard.flat().map((b) => b.callback_data ?? "");
}

function etiquetas(teclado: { inline_keyboard: { text: string }[][] } | undefined): string[] {
  if (!teclado) return [];
  return teclado.inline_keyboard.flat().map((b) => b.text);
}

describe("esCallbackFlujo / parseCallbackFlujo", () => {
  it("reconoce el prefijo flujo:", () => {
    expect(esCallbackFlujo("flujo:cancelar")).toBe(true);
    expect(esCallbackFlujo("nav:menu")).toBe(false);
    expect(esCallbackFlujo("accion:ver_contrato")).toBe(false);
  });

  it("separa acción y valor", () => {
    expect(parseCallbackFlujo("flujo:opt:mensual")).toMatchObject({ accion: "opt", valor: "mensual" });
    expect(parseCallbackFlujo("flujo:iniciar:crear_persona")).toMatchObject({
      accion: "iniciar",
      valor: "crear_persona",
    });
    expect(parseCallbackFlujo("flujo:cancelar")).toMatchObject({ accion: "cancelar", valor: undefined });
  });
});

describe("renderResultado", () => {
  it("arma botones de opciones para una pregunta de tipo opciones", () => {
    const resultado: ResultadoFlujo = {
      tipo: "pregunta",
      texto: "¿Cada cuánto se actualiza?",
      campo: {
        tipo: "opciones",
        opciones: [
          { valor: "mensual", etiqueta: "Mensual" },
          { valor: "trimestral", etiqueta: "Trimestral" },
        ],
      },
    };
    const { teclado } = renderResultado(resultado);
    expect(botones(teclado)).toEqual(
      expect.arrayContaining(["flujo:opt:mensual", "flujo:opt:trimestral", "flujo:cancelar"]),
    );
  });

  it("arma botón de confirmar/cancelar para una confirmación", () => {
    const resultado: ResultadoFlujo = {
      tipo: "pregunta",
      texto: "Confirmá los datos.",
      campo: { tipo: "confirmacion" },
    };
    const { teclado } = renderResultado(resultado);
    expect(botones(teclado)).toEqual(["flujo:confirmar", "flujo:cancelar"]);
  });

  it("listado inicial de existentes (sin buscar): sin botón de 'buscar de nuevo'", () => {
    const resultado: ResultadoFlujo = {
      tipo: "candidatos",
      texto: "¿Quién es el propietario?",
      candidatos: [
        { id: "a", etiqueta: "Juan Pérez" },
        { id: "b", etiqueta: "Juan Gómez" },
      ],
      permiteCrear: "crear_persona",
      etiquetaCrear: "➕ Crear propietario",
      esBusqueda: false,
    };
    const { teclado } = renderResultado(resultado);
    expect(botones(teclado)).toEqual(["flujo:sel:0", "flujo:sel:1", "flujo:crear:crear_persona", "flujo:cancelar"]);
    expect(etiquetas(teclado)).toContain("➕ Crear propietario");
  });

  it("resultado de una búsqueda real: agrega 'buscar de nuevo' y usa la etiqueta de crear", () => {
    const resultado: ResultadoFlujo = {
      tipo: "candidatos",
      texto: 'Encontré varias coincidencias para "Juan", elegí una:',
      candidatos: [
        { id: "a", etiqueta: "Juan Pérez" },
        { id: "b", etiqueta: "Juan Gómez" },
      ],
      permiteCrear: "crear_persona",
      etiquetaCrear: "➕ Crear inquilino",
      esBusqueda: true,
    };
    const { teclado } = renderResultado(resultado);
    expect(botones(teclado)).toEqual([
      "flujo:sel:0",
      "flujo:sel:1",
      "flujo:crear:crear_persona",
      "flujo:buscar_de_nuevo",
      "flujo:cancelar",
    ]);
    expect(etiquetas(teclado)).toContain("➕ Crear inquilino");
  });

  it("sin etiquetaCrear, usa el texto genérico '➕ Crear nuevo'", () => {
    const resultado: ResultadoFlujo = {
      tipo: "candidatos",
      texto: "No encontré nada.",
      candidatos: [],
      permiteCrear: "crear_persona",
      esBusqueda: true,
    };
    const { teclado } = renderResultado(resultado);
    expect(etiquetas(teclado)).toContain("➕ Crear nuevo");
  });

  it("listado inicial vacío (nadie cargado todavía) sin permiteCrear: solo cancelar", () => {
    const resultado: ResultadoFlujo = { tipo: "candidatos", texto: "¿Quién es?", candidatos: [], esBusqueda: false };
    const { teclado } = renderResultado(resultado);
    expect(botones(teclado)).toEqual(["flujo:cancelar"]);
  });

  it("un resultado completado sin botones post-acción no trae teclado", () => {
    const resultado: ResultadoFlujo = { tipo: "completado", texto: "Persona registrada." };
    const { teclado } = renderResultado(resultado);
    expect(teclado).toBeUndefined();
  });

  it("un resultado cancelado no trae teclado", () => {
    const { texto, teclado } = renderResultado({ tipo: "cancelado", texto: "Cancelado." });
    expect(texto).toBe("Cancelado.");
    expect(teclado).toBeUndefined();
  });

  it("confirmar_cancelacion arma los botones de sí/continuar, sin cancelar recursivo", () => {
    const { texto, teclado } = renderResultado({ tipo: "confirmar_cancelacion", texto: "¿Estás seguro?" });
    expect(texto).toBe("¿Estás seguro?");
    expect(botones(teclado)).toEqual(["flujo:cancelar_si", "flujo:continuar"]);
  });

  it("agrega el botón de Omitir solo cuando el campo es opcional", () => {
    const opcional = renderResultado({ tipo: "pregunta", texto: "¿DNI?", campo: { tipo: "texto", opcional: true } });
    expect(botones(opcional.teclado)).toEqual(["flujo:omitir", "flujo:cancelar"]);

    const requerido = renderResultado({ tipo: "pregunta", texto: "¿Nombre?", campo: { tipo: "texto" } });
    expect(botones(requerido.teclado)).toEqual(["flujo:cancelar"]);
  });

  it("agrega el botón de Hoy solo cuando la fecha lo permite", () => {
    const { teclado } = renderResultado({
      tipo: "pregunta",
      texto: "¿Fecha de pago?",
      campo: { tipo: "fecha", permitirHoy: true },
    });
    expect(botones(teclado)).toEqual(["flujo:hoy", "flujo:cancelar"]);
  });
});

describe("tecladoModificar", () => {
  it("ofrece corregir propiedad, pago, gasto y alquiler actual", () => {
    expect(botones(tecladoModificar())).toEqual([
      "flujo:iniciar:editar_propiedad",
      "flujo:iniciar:crear_recibo",
      "flujo:iniciar:corregir_gasto",
      "flujo:iniciar:registrar_alquiler_actual",
    ]);
  });
});

describe("tecladoNuevaCarga", () => {
  it("ofrece los 9 flujos de alta como accesos directos", () => {
    const teclado = tecladoNuevaCarga();
    const datos = botones(teclado);
    expect(datos).toHaveLength(9);
    expect(datos).toEqual(
      expect.arrayContaining([
        "flujo:iniciar:crear_persona",
        "flujo:iniciar:crear_propiedad",
        "flujo:iniciar:crear_contrato",
        "flujo:iniciar:crear_recibo",
        "flujo:iniciar:crear_gasto",
        "flujo:iniciar:cargar_seguro_finaer",
        "flujo:iniciar:cargar_pagos_anteriores",
        "flujo:iniciar:pagar_gasto",
        "flujo:iniciar:cargar_gastos",
      ]),
    );
  });
});

describe("botones de flujo con número de carga", () => {
  it("marca los botones del flujo y el parse lo lee", () => {
    const { teclado } = renderResultado(
      { tipo: "candidatos", texto: "¿Cuál?", candidatos: [{ id: "a", etiqueta: "A" }] },
      7,
    );
    const datos = botones(teclado);
    expect(datos).toEqual(["flujo:sel:0~7", "flujo:cancelar~7"]);
    expect(parseCallbackFlujo("flujo:sel:0~7")).toEqual({ accion: "sel", valor: "0", carga: 7 });
    expect(parseCallbackFlujo("flujo:iniciar:crear_gasto")).toEqual({
      accion: "iniciar",
      valor: "crear_gasto",
      carga: undefined,
    });
  });

  it("los botones para iniciar una carga no se marcan", () => {
    expect(botones(tecladoNuevaCarga()).every((d) => !d.includes("~"))).toBe(true);
  });
});
