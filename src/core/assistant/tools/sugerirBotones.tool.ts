import { z } from "zod";
import { defineTool } from "../defineTool.js";

/** Contextos que el modelo señala a mano, llamando a sugerir_botones junto con su pregunta. */
export const CONTEXTOS_MODELO = [
  "seleccion_persona",
  "indice",
  "frecuencia",
  "finaer_si_no",
  "responsable_gasto",
  "estado_pago",
  "propiedad_detalle",
  "contrato_detalle",
] as const;

/** Contextos que nunca señala el modelo — se infieren solos cuando una tool de alta se ejecuta con éxito. */
export const CONTEXTOS_INFERIDOS = ["post_propiedad", "post_contrato", "post_pago", "post_gasto"] as const;

export type ContextoModelo = (typeof CONTEXTOS_MODELO)[number];
export type ContextoTeclado = ContextoModelo | (typeof CONTEXTOS_INFERIDOS)[number];

export const sugerirBotonesTool = defineTool({
  name: "sugerir_botones",
  description:
    "Llamala JUNTO con tu respuesta en texto (no en vez de) cada vez que le estés haciendo al usuario una " +
    "pregunta de opción múltiple, para que el bot le muestre botones con las opciones. No cambia nada en la " +
    "base de datos, solo indica qué botones mostrar. Usar 'contexto':\n" +
    "- seleccion_persona: cuando preguntás si una persona nueva es propietario, inquilino o garante.\n" +
    "- indice: cuando preguntás con qué índice se actualiza un contrato (IPC/ICL/otro).\n" +
    "- frecuencia: cuando preguntás cada cuánto se actualiza el alquiler de un contrato.\n" +
    "- finaer_si_no: cuando preguntás si un contrato tiene Seguro Finaer.\n" +
    "- responsable_gasto: cuando preguntás quién paga un gasto, el propietario o el inquilino.\n" +
    "- estado_pago: cuando preguntás por qué estado de pago filtrar una consulta (pendiente/pagado/parcial/atrasado).\n" +
    "- propiedad_detalle: cuando mostrás el detalle de UNA propiedad puntual (no una lista).\n" +
    "- contrato_detalle: cuando mostrás el detalle de UN contrato puntual (no una lista).",
  inputSchema: z.object({ contexto: z.enum(CONTEXTOS_MODELO) }),
  run: async () => "ok",
});
