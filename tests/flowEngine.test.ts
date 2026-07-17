import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CALLBACK_CANCELAR,
  CALLBACK_CONFIRMAR,
  CALLBACK_HOY,
  CALLBACK_OMITIR,
  cancelarFlujo,
  crearEstadoFlujo,
  flujoActivo,
  iniciarFlujo,
  procesarSeleccion,
  procesarTexto,
  type RegistroFlujos,
} from "../src/core/flows/flowEngine.js";
import {
  type CandidatoFlujo,
  type DefinicionFlujo,
  etiquetaKey,
  type FlowId,
  type FlowState,
} from "../src/core/flows/types.js";

// Registro de flujos 100% en memoria (sin tocar la base) para testear la mecánica genérica del
// motor: avance lineal, saltos condicionales, validación por tipo de campo, búsqueda de entidad,
// sub-flujos (alta inline) y confirmación final — reutilizando las claves reales de FlowId.

function flujoDummy(id: FlowId): DefinicionFlujo {
  return {
    id,
    titulo: id,
    etiqueta: () => id,
    pasos: [{ id: "__confirmar", pregunta: () => "ok", campo: { tipo: "confirmacion" } }],
    ejecutar: async () => `Hecho.\n(id: dummy-${id})`,
  };
}

const flujoPersonaFake: DefinicionFlujo = {
  id: "crear_persona",
  titulo: "Persona (test)",
  etiqueta: (datos) => datos.nombre as string,
  pasos: [
    { id: "nombre", pregunta: () => "¿Nombre?", campo: { tipo: "texto" } },
    { id: "dni", pregunta: () => "¿DNI? (opcional)", campo: { tipo: "texto", opcional: true } },
    { id: "__confirmar", pregunta: (d) => `Confirmá: ${d.nombre}`, campo: { tipo: "confirmacion" } },
  ],
  ejecutar: async (datos) => `Persona de prueba registrada.\n(id: persona-fake-1)\nnombre=${datos.nombre}`,
};

function crearFlujoPropiedadFake(buscarResponsable: (q: string) => Promise<CandidatoFlujo[]>): DefinicionFlujo {
  return {
    id: "crear_propiedad",
    titulo: "Propiedad (test)",
    etiqueta: (datos) => datos.nombre as string,
    pasos: [
      { id: "nombre", pregunta: () => "¿Nombre?", campo: { tipo: "texto" } },
      { id: "apodo", pregunta: () => "¿Apodo? (opcional)", campo: { tipo: "texto", opcional: true } },
      { id: "edad", pregunta: () => "¿Edad?", campo: { tipo: "numero", min: 1, max: 120 } },
      { id: "monto", pregunta: () => "¿Monto?", campo: { tipo: "monto" } },
      { id: "fecha", pregunta: () => "¿Fecha?", campo: { tipo: "fecha", permitirHoy: true } },
      { id: "periodo", pregunta: () => "¿Período?", campo: { tipo: "periodo" } },
      {
        id: "color",
        pregunta: () => "¿Color?",
        campo: {
          tipo: "opciones",
          opciones: [
            { valor: "rojo", etiqueta: "Rojo" },
            { valor: "verde", etiqueta: "Verde" },
          ],
        },
      },
      {
        id: "responsable_id",
        pregunta: () => "¿Quién es el responsable?",
        campo: { tipo: "entidad", buscar: buscarResponsable, crear: "crear_persona" },
      },
      { id: "__confirmar", pregunta: (d) => `Confirmá: ${d.nombre}`, campo: { tipo: "confirmacion" } },
    ],
    ejecutar: async (datos) =>
      `Prueba completa registrada.\n(id: propiedad-fake-1)\nresponsable=${datos[etiquetaKey("responsable_id")]}`,
  };
}

function registroCon(buscarResponsable: (q: string) => Promise<CandidatoFlujo[]>): RegistroFlujos {
  return {
    crear_persona: flujoPersonaFake,
    crear_propiedad: crearFlujoPropiedadFake(buscarResponsable),
    crear_contrato: flujoDummy("crear_contrato"),
    crear_recibo: flujoDummy("crear_recibo"),
    crear_gasto: flujoDummy("crear_gasto"),
    cargar_seguro_finaer: flujoDummy("cargar_seguro_finaer"),
  };
}

let estado: FlowState;

beforeEach(() => {
  estado = crearEstadoFlujo();
});

describe("flowEngine — avance lineal y validación por tipo de campo", () => {
  it("recorre texto → texto opcional (omitido) → número → monto → fecha (hoy) → período → opciones → entidad → confirmación → completado", async () => {
    const buscar = vi.fn(async () => [{ id: "persona-existente", etiqueta: "María López" }] as CandidatoFlujo[]);
    const registro = registroCon(buscar);

    let r = iniciarFlujo(estado, "crear_propiedad", {}, registro);
    expect(r).toEqual({ tipo: "pregunta", texto: "¿Nombre?", campo: { tipo: "texto" } });

    r = await procesarTexto(estado, "Depto Centro", [], registro);
    expect(r.tipo).toBe("pregunta");
    if (r.tipo === "pregunta") expect(r.texto).toBe("¿Apodo? (opcional)");

    r = await procesarSeleccion(estado, CALLBACK_OMITIR, undefined, registro);
    expect(r.tipo).toBe("pregunta");
    if (r.tipo === "pregunta") expect(r.texto).toBe("¿Edad?");

    // formato inválido: re-pregunta sin salir del flujo (no interrumpe, no llama nada externo)
    r = await procesarTexto(estado, "no-es-un-numero", [], registro);
    expect(r.tipo).toBe("reprompt");
    expect(flujoActivo(estado)).toBe(true);

    r = await procesarTexto(estado, "999", [], registro); // fuera de rango (max 120)
    expect(r.tipo).toBe("reprompt");

    r = await procesarTexto(estado, "30", [], registro);
    if (r.tipo === "pregunta") expect(r.texto).toBe("¿Monto?");

    r = await procesarTexto(estado, "no es un monto", [], registro);
    expect(r.tipo).toBe("reprompt");

    r = await procesarTexto(estado, "850000", [], registro);
    if (r.tipo === "pregunta") expect(r.texto).toBe("¿Fecha?");

    r = await procesarSeleccion(estado, CALLBACK_HOY, undefined, registro);
    if (r.tipo === "pregunta") expect(r.texto).toBe("¿Período?");

    r = await procesarTexto(estado, "13/2026", [], registro); // mes inválido
    expect(r.tipo).toBe("reprompt");

    r = await procesarTexto(estado, "08/2026", [], registro);
    if (r.tipo === "pregunta") expect(r.texto).toBe("¿Color?");

    // "opciones" no acepta texto libre (aunque el texto matchee una opción)
    r = await procesarTexto(estado, "rojo", [], registro);
    expect(r.tipo).toBe("reprompt");

    r = await procesarSeleccion(estado, "opt", "rojo", registro);
    if (r.tipo === "pregunta") expect(r.texto).toBe("¿Quién es el responsable?");

    // 1 sola coincidencia: auto-selecciona y avanza directo a la confirmación, sin mostrar candidatos
    r = await procesarTexto(estado, "María", [], registro);
    expect(r.tipo).toBe("pregunta");
    if (r.tipo === "pregunta") expect(r.campo.tipo).toBe("confirmacion");
    expect(buscar).toHaveBeenCalledWith("María");

    r = await procesarSeleccion(estado, CALLBACK_CONFIRMAR, undefined, registro);
    expect(r.tipo).toBe("completado");
    if (r.tipo === "completado") expect(r.texto).toContain("responsable=María López");
    expect(flujoActivo(estado)).toBe(false);
  });
});

describe("flowEngine — búsqueda de entidad con varias coincidencias", () => {
  it("ofrece candidatos para elegir por botón cuando hay más de una coincidencia", async () => {
    const candidatos: CandidatoFlujo[] = [
      { id: "p1", etiqueta: "Juan Pérez" },
      { id: "p2", etiqueta: "Juan Gómez" },
    ];
    const registro = registroCon(async () => candidatos);
    avanzarHastaResponsable(estado, registro);

    const r = await procesarTexto(estado, "Juan", [], registro);
    expect(r.tipo).toBe("candidatos");
    if (r.tipo === "candidatos") {
      expect(r.candidatos).toEqual(candidatos);
      expect(r.permiteCrear).toBe("crear_persona");
    }

    const r2 = await procesarSeleccion(estado, "sel", "1", registro);
    expect(r2.tipo).toBe("pregunta");
    if (r2.tipo === "pregunta") expect(r2.campo.tipo).toBe("confirmacion");
  });

  it("sin coincidencias, ofrece crear una entidad nueva (sub-flujo) y la inyecta al volver", async () => {
    const registro = registroCon(async () => []);
    avanzarHastaResponsable(estado, registro);

    const r = await procesarTexto(estado, "Nadie conocido", [], registro);
    expect(r.tipo).toBe("candidatos");
    if (r.tipo === "candidatos") {
      expect(r.candidatos).toEqual([]);
      expect(r.permiteCrear).toBe("crear_persona");
    }

    // dispara el sub-flujo de alta inline
    const rSub = await procesarSeleccion(estado, "crear", "crear_persona", registro);
    expect(rSub.tipo).toBe("pregunta");
    if (rSub.tipo === "pregunta") expect(rSub.texto).toBe("¿Nombre?");

    await procesarTexto(estado, "Nueva Persona", [], registro);
    await procesarSeleccion(estado, CALLBACK_OMITIR, undefined, registro); // dni opcional

    const rConfirmarSub = await procesarSeleccion(estado, CALLBACK_CONFIRMAR, undefined, registro);
    // vuelve al flujo padre, ya con el responsable resuelto — el próximo paso es la confirmación del padre
    expect(rConfirmarSub.tipo).toBe("pregunta");
    if (rConfirmarSub.tipo === "pregunta") expect(rConfirmarSub.campo.tipo).toBe("confirmacion");

    const rFinal = await procesarSeleccion(estado, CALLBACK_CONFIRMAR, undefined, registro);
    expect(rFinal.tipo).toBe("completado");
    if (rFinal.tipo === "completado") expect(rFinal.texto).toContain("responsable=Nueva Persona");
  });
});

describe("flowEngine — interrupción y cancelación", () => {
  it("procesarTexto detecta una interrupción sin tocar el flujo (el llamador decide cancelarlo)", async () => {
    const registro = registroCon(async () => []);
    iniciarFlujo(estado, "crear_propiedad", {}, registro);

    const r = await procesarTexto(estado, "¿Qué contratos vencen este mes?", [], registro);
    expect(r).toEqual({ tipo: "interrumpido", textoOriginal: "¿Qué contratos vencen este mes?" });
    expect(flujoActivo(estado)).toBe(true); // el motor no cancela solo

    cancelarFlujo(estado);
    expect(flujoActivo(estado)).toBe(false);
  });

  it("CALLBACK_CANCELAR vacía toda la pila, incluso en medio de un sub-flujo", async () => {
    const registro = registroCon(async () => []);
    avanzarHastaResponsable(estado, registro);
    await procesarSeleccion(estado, "crear", "crear_persona", registro); // entra al sub-flujo

    const r = await procesarSeleccion(estado, CALLBACK_CANCELAR, undefined, registro);
    expect(r).toEqual({ tipo: "cancelado", texto: "Cancelado." });
    expect(flujoActivo(estado)).toBe(false);
  });
});

/** Helper de test: avanza el flujo de propiedad fake hasta dejarlo parado justo en el paso "responsable_id". */
function avanzarHastaResponsable(estado: FlowState, registro: RegistroFlujos): void {
  iniciarFlujo(estado, "crear_propiedad", {}, registro);
  const frame = estado.pila[0]!;
  frame.datos = {
    nombre: "Depto Centro",
    edad: 30,
    monto: "850000",
    fecha: "2026-08-01",
    periodo: "2026-08",
    color: "rojo",
  };
  frame.pasoActual = 7; // índice del paso "responsable_id" en crearFlujoPropiedadFake
}
