import { registrarAlquilerActualPorId } from "../../assistant/tools/registrarAlquilerActual.tool.js";
import * as vencimientosService from "../../services/vencimientos.service.js";
import { hoyISO } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { buscarContratosVigentesParaFlujo } from "../entidadHelpers.js";
import { type CandidatoFlujo, type DefinicionFlujo, etiquetaKey } from "../types.js";

/** Sin búsqueda escrita, muestra primero los contratos con la actualización ya vencida. */
async function buscarContratos(query: string): Promise<CandidatoFlujo[]> {
  if (query.trim() === "") {
    const pendientes = await vencimientosService.listarVencimientos(undefined, hoyISO(), "actualizacion_alquiler");
    if (pendientes.length > 0) {
      return pendientes.map((v) => ({
        id: v.entidadId,
        etiqueta: `${v.descripcion.replace("Actualización de alquiler de ", "")} — ${v.propiedad}`,
      }));
    }
  }
  return buscarContratosVigentesParaFlujo(query);
}

export const registrarAlquilerActualFlow: DefinicionFlujo = {
  id: "registrar_alquiler_actual",
  titulo: "⚡ Alquiler actual",
  etiqueta: (datos) => datos[etiquetaKey("contrato_id")] as string,
  pasos: [
    {
      id: "contrato_id",
      pregunta: () => "¿De qué contrato? Escribí el nombre del inquilino o la dirección.",
      campo: { tipo: "entidad", buscar: buscarContratos },
    },
    {
      id: "monto",
      pregunta: () =>
        "¿Cuánto están pagando hoy por mes? Si sigue igual, tocá Omitir y solo se marca la actualización como hecha.",
      campo: { tipo: "monto", opcional: true },
    },
    {
      id: "__confirmar",
      pregunta: (datos) =>
        [
          "Confirmá la actualización:",
          "",
          `Contrato: ${datos[etiquetaKey("contrato_id")]}`,
          datos.monto ? `Alquiler actual: ${formatoARS(datos.monto as string)}` : "Alquiler actual: sin cambios",
        ].join("\n"),
      campo: { tipo: "confirmacion" },
    },
  ],
  ejecutar: (datos) =>
    registrarAlquilerActualPorId(datos.contrato_id as string, (datos.monto as string | undefined) || undefined),
  botonesPostAccion: "post_contrato",
};
