import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CALLBACK_CANCELAR,
  CALLBACK_CANCELAR_CONFIRMADO,
  CALLBACK_CONFIRMAR,
  CALLBACK_CONTINUAR,
  CALLBACK_HOY,
  CALLBACK_OMITIR,
  flujoActivo,
  iniciarFlujo,
  procesarSeleccion,
  procesarTexto,
  type RegistroFlujos,
} from "../src/core/flows/flowEngine.js";
import {
  type CandidatoFlujo,
  crearEstadoFlujo,
  type DefinicionFlujo,
  etiquetaKey,
  type FlowId,
  type FlowState,
} from "../src/core/flows/types.js";

// Registro de flujos 100% en memoria (sin tocar la base) para testear la mecánica genérica del
// motor: avance lineal, saltos condicionales, listado inicial de existentes, validación por tipo
// de campo, sub-flujos (alta inline con datos precargados), cancelación en dos pasos y
// confirmación final — reutilizando las claves reales de FlowId.

function flujoDummy(id: FlowId): DefinicionFlujo {
  return {
    id,
    titulo: id,
    etiqueta: () => id,
    pasos: [{ id: "__confirmar", pregunta: () => "ok", campo: { tipo: "confirmacion" } }],
    ejecutar: async () => `Hecho.\n(id: dummy-${id})`,
  };
}

// Igual que crearPersona.flow.ts real: un primer paso que se salta solo si ya viene precargado
// (alta inline desde un sub-flujo, ej. el rol de la persona).
const flujoPersonaFake: DefinicionFlujo = {
  id: "crear_persona",
  titulo: "Persona (test)",
  etiqueta: (datos) => datos.nombre as string,
  pasos: [
    {
      id: "tipo_persona",
      pregunta: () => "¿Qué tipo de persona es?",
      campo: {
        tipo: "opciones",
        opciones: [
          { valor: "inquilino", etiqueta: "Inquilino" },
          { valor: "garante", etiqueta: "Garante" },
        ],
      },
      saltar: (datos) => datos.tipo_persona !== undefined,
    },
    { id: "nombre", pregunta: () => "¿Nombre?", campo: { tipo: "texto" } },
    { id: "dni", pregunta: () => "¿DNI? (opcional)", campo: { tipo: "texto", opcional: true } },
    { id: "__confirmar", pregunta: (d) => `Confirmá: ${d.nombre}`, campo: { tipo: "confirmacion" } },
  ],
  ejecutar: async (datos) =>
    `Persona de prueba registrada.\n(id: persona-fake-1)\nnombre=${datos.nombre}\ntipo=${datos.tipo_persona}`,
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
        campo: {
          tipo: "entidad",
          buscar: buscarResponsable,
          crear: "crear_persona",
          datosCrear: { tipo_persona: "garante" },
          etiquetaCrear: "➕ Crear responsable",
        },
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
    registrar_alquiler_actual: flujoDummy("registrar_alquiler_actual"),
    cargar_pagos_anteriores: flujoDummy("cargar_pagos_anteriores"),
    pagar_gasto: flujoDummy("pagar_gasto"),
    corregir_gasto: flujoDummy("corregir_gasto"),
    editar_propiedad: flujoDummy("editar_propiedad"),
    cargar_gastos: flujoDummy("cargar_gastos"),
  };
}

async function avanzarHastaResponsable(estado: FlowState, registro: RegistroFlujos) {
  await iniciarFlujo(estado, "crear_propiedad", {}, registro);
  await procesarTexto(estado, "Depto Centro", [], registro); // nombre
  await procesarSeleccion(estado, CALLBACK_OMITIR, undefined, registro); // apodo
  await procesarTexto(estado, "30", [], registro); // edad
  await procesarTexto(estado, "850000", [], registro); // monto
  await procesarSeleccion(estado, CALLBACK_HOY, undefined, registro); // fecha
  await procesarTexto(estado, "08/2026", [], registro); // periodo
  return procesarSeleccion(estado, "opt", "rojo", registro); // color -> aterriza en "responsable_id"
}

let estado: FlowState;

beforeEach(() => {
  estado = crearEstadoFlujo();
});

describe("flowEngine — avance lineal y validación por tipo de campo", () => {
  it("recorre texto → texto opcional (omitido) → número → monto → fecha (hoy) → período → opciones → confirmación → completado", async () => {
    const buscar = vi.fn(async () => [] as CandidatoFlujo[]);
    const registro = registroCon(buscar);

    let r = await iniciarFlujo(estado, "crear_propiedad", {}, registro);
    expect(r).toEqual({ tipo: "pregunta", texto: "¿Nombre?", campo: { tipo: "texto" } });

    r = await procesarTexto(estado, "Depto Centro", [], registro);
    if (r.tipo === "pregunta") expect(r.texto).toBe("¿Apodo? (opcional)");

    r = await procesarSeleccion(estado, CALLBACK_OMITIR, undefined, registro);
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

    // al elegir "rojo" aterriza en el paso "entidad" (responsable_id), que sin candidatos
    // existentes muestra el listado vacío (candidatos: []) en vez de la pregunta lisa
    r = await procesarSeleccion(estado, "opt", "rojo", registro);
    expect(r.tipo).toBe("candidatos");
    if (r.tipo === "candidatos") {
      expect(r.candidatos).toEqual([]);
      expect(r.esBusqueda).toBe(false);
      expect(r.permiteCrear).toBe("crear_persona");
      expect(r.etiquetaCrear).toBe("➕ Crear responsable");
    }
  });
});

describe("flowEngine — paso entidad: listado inicial de existentes", () => {
  it("al aterrizar en el paso muestra los existentes de entrada, sin que el usuario escriba nada", async () => {
    const existentes: CandidatoFlujo[] = [
      { id: "p1", etiqueta: "Juan Pérez" },
      { id: "p2", etiqueta: "Juan Gómez" },
    ];
    const buscar = vi.fn(async () => existentes);
    const registro = registroCon(buscar);

    await avanzarHastaResponsable(estado, registro);

    expect(buscar).toHaveBeenLastCalledWith("");

    // elegir directo del listado inicial (sin escribir), avanza a confirmación
    const r = await procesarSeleccion(estado, "sel", "1", registro);
    expect(r.tipo).toBe("pregunta");
    if (r.tipo === "pregunta") expect(r.campo.tipo).toBe("confirmacion");

    const rFinal = await procesarSeleccion(estado, CALLBACK_CONFIRMAR, undefined, registro);
    expect(rFinal.tipo).toBe("completado");
    if (rFinal.tipo === "completado") expect(rFinal.texto).toContain("responsable=Juan Gómez");
  });

  it("recorta el listado inicial a 8 aunque existan más", async () => {
    const muchos: CandidatoFlujo[] = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, etiqueta: `Persona ${i}` }));
    const registro = registroCon(async () => muchos);

    const r = await avanzarHastaResponsable(estado, registro);

    expect(r.tipo).toBe("candidatos");
    if (r.tipo === "candidatos") expect(r.candidatos).toHaveLength(8);
  });

  it("escribir texto en cualquier momento sigue buscando (no queda atado al listado inicial)", async () => {
    const registro = registroCon(async (q) =>
      q === "María" ? [{ id: "m1", etiqueta: "María López" }] : [{ id: "otro", etiqueta: "Otro" }],
    );
    await avanzarHastaResponsable(estado, registro); // ya mostró el listado inicial

    const r = await procesarTexto(estado, "María", [], registro);
    // 1 sola coincidencia real: auto-selecciona y avanza directo a confirmación
    expect(r.tipo).toBe("pregunta");
    if (r.tipo === "pregunta") expect(r.campo.tipo).toBe("confirmacion");

    const rFinal = await procesarSeleccion(estado, CALLBACK_CONFIRMAR, undefined, registro);
    if (rFinal.tipo === "completado") expect(rFinal.texto).toContain("responsable=María López");
  });

  it("una búsqueda por texto marca esBusqueda: true (a diferencia del listado inicial)", async () => {
    const candidatos: CandidatoFlujo[] = [
      { id: "p1", etiqueta: "Juan Pérez" },
      { id: "p2", etiqueta: "Juan Gómez" },
    ];
    const registro = registroCon(async () => candidatos);
    await avanzarHastaResponsable(estado, registro);

    const r = await procesarTexto(estado, "Juan", [], registro);
    expect(r.tipo).toBe("candidatos");
    if (r.tipo === "candidatos") expect(r.esBusqueda).toBe(true);
  });
});

describe("flowEngine — sub-flujo con datos precargados", () => {
  it("crear una entidad nueva desde 'entidad' precarga datosCrear y no vuelve a preguntar lo ya sabido", async () => {
    const registro = registroCon(async () => []);
    await avanzarHastaResponsable(estado, registro); // muestra listado vacío, permiteCrear crear_persona

    const rSub = await procesarSeleccion(estado, "crear", "crear_persona", registro);
    // el sub-flujo de persona ya trae tipo_persona="garante" precargado (datosCrear), así que
    // el paso "tipo_persona" se salta solo y arranca directo en "nombre"
    expect(rSub.tipo).toBe("pregunta");
    if (rSub.tipo === "pregunta") expect(rSub.texto).toBe("¿Nombre?");

    await procesarTexto(estado, "Nueva Persona", [], registro);
    await procesarSeleccion(estado, CALLBACK_OMITIR, undefined, registro); // dni

    const rConfirmarSub = await procesarSeleccion(estado, CALLBACK_CONFIRMAR, undefined, registro);
    // vuelve al flujo padre, ya con el responsable resuelto — el próximo paso es su confirmación
    expect(rConfirmarSub.tipo).toBe("pregunta");
    if (rConfirmarSub.tipo === "pregunta") expect(rConfirmarSub.campo.tipo).toBe("confirmacion");

    const rFinal = await procesarSeleccion(estado, CALLBACK_CONFIRMAR, undefined, registro);
    expect(rFinal.tipo).toBe("completado");
    if (rFinal.tipo === "completado") expect(rFinal.texto).toContain("responsable=Nueva Persona");
  });

  it("sin datosCrear precargados, el sub-flujo sí pregunta el tipo de persona", async () => {
    const registro = registroCon(async () => []);
    // arranca crear_persona directo (top-level), sin pasar por un paso "entidad" que precargue nada
    const r = await iniciarFlujo(estado, "crear_persona", {}, registro);
    expect(r.tipo).toBe("pregunta");
    if (r.tipo === "pregunta") expect(r.texto).toBe("¿Qué tipo de persona es?");
  });
});

describe("flowEngine — el (id: ...) nunca llega al resultado final que ve el usuario", () => {
  it("el texto de 'completado' no incluye el marcador (id: ...), pero el sub-flujo sí lo usa para inyectar el id", async () => {
    const registro = registroCon(async () => []);
    const r = await iniciarFlujo(estado, "crear_persona", { tipo_persona: "inquilino" }, registro);
    expect(r.tipo).toBe("pregunta"); // tipo_persona ya vino precargado, arranca en "nombre"

    await procesarTexto(estado, "Alguien", [], registro);
    await procesarSeleccion(estado, CALLBACK_OMITIR, undefined, registro);
    const rFinal = await procesarSeleccion(estado, CALLBACK_CONFIRMAR, undefined, registro);

    expect(rFinal.tipo).toBe("completado");
    if (rFinal.tipo === "completado") {
      expect(rFinal.texto).not.toContain("(id:");
      expect(rFinal.texto).toContain("nombre=Alguien");
    }
  });
});

describe("flowEngine — cancelación en dos pasos", () => {
  it("cancelar pide confirmación sin tocar los datos ya cargados; continuar los conserva", async () => {
    const registro = registroCon(async () => []);
    await iniciarFlujo(estado, "crear_persona", { tipo_persona: "inquilino" }, registro);
    await procesarTexto(estado, "Alguien", [], registro); // nombre ya cargado, quedó parado en "dni"

    const rPedido = await procesarSeleccion(estado, CALLBACK_CANCELAR, undefined, registro);
    expect(rPedido.tipo).toBe("confirmar_cancelacion");
    expect(flujoActivo(estado)).toBe(true); // no se tocó nada todavía

    const rContinuar = await procesarSeleccion(estado, CALLBACK_CONTINUAR, undefined, registro);
    expect(rContinuar.tipo).toBe("pregunta");
    if (rContinuar.tipo === "pregunta") expect(rContinuar.texto).toBe("¿DNI? (opcional)");

    // el flujo sigue intacto: completar normalmente conserva el nombre ya cargado antes de cancelar
    await procesarSeleccion(estado, CALLBACK_OMITIR, undefined, registro);
    const rFinal = await procesarSeleccion(estado, CALLBACK_CONFIRMAR, undefined, registro);
    if (rFinal.tipo === "completado") expect(rFinal.texto).toContain("nombre=Alguien");
  });

  it("confirmar la cancelación vacía toda la pila, incluso en medio de un sub-flujo", async () => {
    const registro = registroCon(async () => []);
    await avanzarHastaResponsable(estado, registro);
    await procesarSeleccion(estado, "crear", "crear_persona", registro); // entra al sub-flujo

    await procesarSeleccion(estado, CALLBACK_CANCELAR, undefined, registro);
    const r = await procesarSeleccion(estado, CALLBACK_CANCELAR_CONFIRMADO, undefined, registro);
    expect(r).toEqual({ tipo: "cancelado", texto: "Cancelado." });
    expect(flujoActivo(estado)).toBe(false);
  });
});

describe("flowEngine — interrupción por texto", () => {
  it("procesarTexto detecta una interrupción sin tocar el flujo (el llamador decide cancelarlo)", async () => {
    const registro = registroCon(async () => []);
    await iniciarFlujo(estado, "crear_propiedad", {}, registro);

    const r = await procesarTexto(estado, "¿Qué contratos vencen este mes?", [], registro);
    expect(r).toEqual({ tipo: "interrumpido", textoOriginal: "¿Qué contratos vencen este mes?" });
    expect(flujoActivo(estado)).toBe(true); // el motor no cancela solo
  });
});

describe("flowEngine — datos iniciales, validación por paso y rechazo", () => {
  function registroContrato(ejecutar?: DefinicionFlujo["ejecutar"]): RegistroFlujos {
    const flujo: DefinicionFlujo = {
      id: "crear_contrato",
      titulo: "Contrato (test)",
      etiqueta: () => "contrato",
      pasos: [
        {
          id: "propiedad_id",
          pregunta: () => "¿Propiedad?",
          campo: { tipo: "entidad", buscar: async () => [{ id: "p1", etiqueta: "Cerrito 4070" }] },
        },
        { id: "fecha_inicio", pregunta: () => "¿Inicio?", campo: { tipo: "fecha" } },
        {
          id: "fecha_fin",
          pregunta: () => "¿Fin?",
          campo: { tipo: "fecha" },
          validar: async (d) =>
            (d.fecha_inicio as string) < "2027-01-01"
              ? { mensaje: "⚠️ Se pisa con el contrato vigente.", volverA: "fecha_inicio" }
              : undefined,
        },
        { id: "__confirmar", pregunta: () => "Confirmá", campo: { tipo: "confirmacion" } },
      ],
      ejecutar: ejecutar ?? (async () => "Contrato registrado.\n(id: c-nuevo)"),
      botonesPostAccion: "post_contrato",
    };
    const registro = {} as RegistroFlujos;
    for (const id of Object.keys(registroCon(async () => [])) as FlowId[]) registro[id] = flujoDummy(id);
    registro.crear_contrato = flujo;
    return registro;
  }

  it("un paso que ya viene en los datos iniciales no se vuelve a preguntar", async () => {
    const estado = crearEstadoFlujo();
    const r = await iniciarFlujo(
      estado,
      "crear_contrato",
      { propiedad_id: "p1", [etiquetaKey("propiedad_id")]: "Cerrito 4070" },
      registroContrato(),
    );
    expect(r).toMatchObject({ tipo: "pregunta", texto: "¿Inicio?" });
  });

  it("si la validación falla, avisa y vuelve a preguntar desde el paso indicado", async () => {
    const registro = registroContrato();
    const estado = crearEstadoFlujo();
    await iniciarFlujo(estado, "crear_contrato", { propiedad_id: "p1" }, registro);
    await procesarTexto(estado, "01/03/2026", [], registro);
    const r = await procesarTexto(estado, "28/02/2028", [], registro);
    expect(r.tipo).toBe("pregunta");
    expect("texto" in r && r.texto).toBe("⚠️ Se pisa con el contrato vigente.\n\n¿Inicio?");

    await procesarTexto(estado, "01/03/2027", [], registro);
    const ok = await procesarTexto(estado, "28/02/2029", [], registro);
    expect(ok).toMatchObject({ tipo: "pregunta", texto: "Confirmá" });
  });

  it("al completar devuelve la referencia (propiedad elegida y contrato creado)", async () => {
    const registro = registroContrato();
    const estado = crearEstadoFlujo();
    await iniciarFlujo(estado, "crear_contrato", { propiedad_id: "p1" }, registro);
    await procesarTexto(estado, "01/03/2027", [], registro);
    await procesarTexto(estado, "28/02/2029", [], registro);
    const r = await procesarSeleccion(estado, CALLBACK_CONFIRMAR, undefined, registro);
    expect(r).toMatchObject({
      tipo: "completado",
      botonesPostAccion: "post_contrato",
      referencia: { propiedadId: "p1", contratoId: "c-nuevo" },
    });
  });

  it("si ejecutar rechaza la carga, termina sin botones posteriores", async () => {
    const registro = registroContrato(async () => ({ texto: "⚠️ No cargué el contrato.", rechazado: true }));
    const estado = crearEstadoFlujo();
    await iniciarFlujo(estado, "crear_contrato", { propiedad_id: "p1" }, registro);
    await procesarTexto(estado, "01/03/2027", [], registro);
    await procesarTexto(estado, "28/02/2029", [], registro);
    const r = await procesarSeleccion(estado, CALLBACK_CONFIRMAR, undefined, registro);
    expect(r).toEqual({ tipo: "completado", texto: "⚠️ No cargué el contrato." });
    expect(flujoActivo(estado)).toBe(false);
  });
});

describe("flujo real de varios gastos (cargar_gastos)", () => {
  it("con todo pago no pide vencimientos y corta con 'No hay más'", async () => {
    const { cargarGastosFlow } = await import("../src/core/flows/definiciones/cargarGastos.flow.js");
    const registro = registroCon(async () => []);
    const flujo = {
      ...cargarGastosFlow,
      pasos: cargarGastosFlow.pasos.map((p) =>
        p.id === "propiedad_id"
          ? { ...p, campo: { tipo: "entidad" as const, buscar: async () => [{ id: "p1", etiqueta: "Cerrito 4070" }] } }
          : p,
      ),
      ejecutar: async () => "ok",
    };
    registro.cargar_gastos = flujo;
    const estado = crearEstadoFlujo();
    await iniciarFlujo(estado, "cargar_gastos", {}, registro);
    await procesarSeleccion(estado, "sel", "0", registro);
    await procesarSeleccion(estado, "opt", "si", registro); // pagados
    await procesarSeleccion(estado, CALLBACK_HOY, undefined, registro); // fecha de pago
    await procesarSeleccion(estado, "opt", "omitir", registro); // responsable
    await procesarSeleccion(estado, "opt", "luz", registro);
    const r1 = await procesarTexto(estado, "25000", [], registro);
    expect(r1).toMatchObject({ tipo: "pregunta", texto: "¿Otro gasto? (van 1)" });
    await procesarSeleccion(estado, "opt", "gas", registro);
    await procesarTexto(estado, "18000", [], registro);
    const fin = await procesarSeleccion(estado, "opt", "fin", registro);
    expect(fin.tipo).toBe("pregunta");
    expect("texto" in fin && fin.texto).toContain("Confirmá 2 gasto(s) de Cerrito 4070");
    expect("texto" in fin && fin.texto).toContain("Total gastos: ");
  });
});

describe("flujo real de pago con servicios (crear_recibo)", () => {
  it("después del medio de pago ofrece cargar los servicios, sin pedir vencimiento", async () => {
    const { crearReciboFlow } = await import("../src/core/flows/definiciones/crearRecibo.flow.js");
    const registro = registroCon(async () => []);
    registro.crear_recibo = { ...crearReciboFlow, ejecutar: async () => "ok" };
    const estado = crearEstadoFlujo();
    await iniciarFlujo(
      estado,
      "crear_recibo",
      { contrato_id: "c1", [etiquetaKey("contrato_id")]: "Sebastián — Cerrito 4070" },
      registro,
    );
    await procesarTexto(estado, "10/2026", [], registro);
    await procesarTexto(estado, "450000", [], registro);
    await procesarSeleccion(estado, CALLBACK_HOY, undefined, registro);
    const r = await procesarSeleccion(estado, "opt", "transferencia", registro);
    expect(r).toMatchObject({ tipo: "pregunta" });
    expect("texto" in r && r.texto).toContain("¿Pagó también servicios");
    await procesarSeleccion(estado, "opt", "si", registro);
    await procesarSeleccion(estado, "opt", "luz", registro);
    const otro = await procesarTexto(estado, "25000", [], registro);
    expect(otro).toMatchObject({ texto: "¿Otro gasto? (van 1)" });
    const fin = await procesarSeleccion(estado, "opt", "fin", registro);
    expect("texto" in fin && fin.texto).toContain("Servicios pagados:");
  });

  it("si no pagó servicios, va directo a confirmar", async () => {
    const { crearReciboFlow } = await import("../src/core/flows/definiciones/crearRecibo.flow.js");
    const registro = registroCon(async () => []);
    registro.crear_recibo = { ...crearReciboFlow, ejecutar: async () => "ok" };
    const estado = crearEstadoFlujo();
    await iniciarFlujo(estado, "crear_recibo", { contrato_id: "c1" }, registro);
    await procesarTexto(estado, "10/2026", [], registro);
    await procesarTexto(estado, "450000", [], registro);
    await procesarSeleccion(estado, CALLBACK_HOY, undefined, registro);
    await procesarSeleccion(estado, "opt", "transferencia", registro);
    const r = await procesarSeleccion(estado, "opt", "no", registro);
    expect("texto" in r && r.texto).toContain("Confirmá el pago");
  });
});

describe("marcaPasoActual", () => {
  it("cambia al avanzar de paso y con cada carga nueva", async () => {
    const { marcaPasoActual } = await import("../src/core/flows/flowEngine.js");
    const registro = registroCon(async () => [{ id: "r1", etiqueta: "Responsable 1" }]);
    const estado = crearEstadoFlujo();
    expect(marcaPasoActual(estado)).toBeUndefined();
    await iniciarFlujo(estado, "crear_persona", {}, registro);
    const antes = marcaPasoActual(estado);
    await procesarSeleccion(estado, "opt", "inquilino", registro);
    const despues = marcaPasoActual(estado);
    expect(antes).not.toBe(despues);
    await iniciarFlujo(crearEstadoFlujo(), "crear_persona", {}, registro);
    estado.pila = [];
    await iniciarFlujo(estado, "crear_persona", {}, registro);
    expect(marcaPasoActual(estado)?.startsWith("2.")).toBe(true);
  });
});

describe("marcaPasoActual", () => {
  it("cambia al avanzar de paso y con cada carga nueva", async () => {
    const { marcaPasoActual } = await import("../src/core/flows/flowEngine.js");
    const registro = registroCon(async () => []);
    const estado = crearEstadoFlujo();
    expect(marcaPasoActual(estado)).toBeUndefined();
    await iniciarFlujo(estado, "crear_persona", {}, registro);
    const antes = marcaPasoActual(estado);
    await procesarSeleccion(estado, "opt", "inquilino", registro);
    expect(marcaPasoActual(estado)).not.toBe(antes);
    estado.pila = [];
    await iniciarFlujo(estado, "crear_persona", {}, registro);
    expect(marcaPasoActual(estado)?.startsWith("2.")).toBe(true);
  });
});

describe("medio de pago mixto en crear_recibo", () => {
  it("pide el efectivo, valida que sea menor al total y arma el texto", async () => {
    const { crearReciboFlow, medioPagoTexto } = await import("../src/core/flows/definiciones/crearRecibo.flow.js");
    const registro = registroCon(async () => []);
    registro.crear_recibo = { ...crearReciboFlow, ejecutar: async () => "ok" };
    const estado = crearEstadoFlujo();
    await iniciarFlujo(estado, "crear_recibo", { contrato_id: "c1" }, registro);
    await procesarTexto(estado, "10/2026", [], registro);
    await procesarTexto(estado, "450000", [], registro);
    await procesarSeleccion(estado, CALLBACK_HOY, undefined, registro);
    const r = await procesarSeleccion(estado, "opt", "ambos", registro);
    expect("texto" in r && r.texto).toContain("¿Cuánto fue en efectivo?");
    const mal = await procesarTexto(estado, "500000", [], registro);
    expect("texto" in mal && mal.texto).toContain("El efectivo tiene que ser menor");
    const bien = await procesarTexto(estado, "200000", [], registro);
    expect("texto" in bien && bien.texto).toContain("¿Pagó también servicios");

    const texto = medioPagoTexto({ medio_pago: "ambos", monto: "450000", monto_efectivo: "200000" });
    expect(texto).toMatch(/^efectivo .*200\.000 \+ transferencia .*250\.000$/);
    expect(medioPagoTexto({ medio_pago: "omitir" })).toBeUndefined();
    expect(medioPagoTexto({ medio_pago: "efectivo" })).toBe("efectivo");
  });
});
