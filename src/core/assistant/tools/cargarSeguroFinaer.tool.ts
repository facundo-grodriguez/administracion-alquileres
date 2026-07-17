import { z } from "zod";
import * as contratosRepo from "../../repositories/contratos.repository.js";
import * as pagosService from "../../services/pagos.service.js";
import { formatoFechaAR } from "../../util/fecha.js";
import { defineTool } from "../defineTool.js";

export const cargarSeguroFinaerTool = defineTool({
  name: "cargar_seguro_finaer",
  description:
    "Carga o actualiza los datos del Seguro Finaer de un contrato (número de póliza, vigencia). " +
    "El Finaer forma parte del contrato, no es una entidad aparte — esta tool solo completa esos datos " +
    "en un contrato ya existente. El estado (vigente/vencido) se calcula solo por la fecha de vencimiento.",
  inputSchema: z.object({
    inquilino_o_propiedad: z.string().describe("Nombre del inquilino o dirección de la propiedad"),
    numero_poliza: z.string().optional(),
    fecha_inicio: z.string().optional().describe("YYYY-MM-DD"),
    fecha_vencimiento: z.string().optional().describe("YYYY-MM-DD"),
    observaciones: z.string().optional(),
  }),
  run: async (input) => {
    const resolucion = await pagosService.resolverContrato(input.inquilino_o_propiedad);
    if ("ambiguo" in resolucion) {
      return `Hay más de una coincidencia para "${input.inquilino_o_propiedad}". Pedile al usuario que aclare cuál: ${resolucion.ambiguo.join(", ")}.`;
    }
    if ("noEncontrado" in resolucion) {
      return `No se encontró ningún inquilino ni propiedad que coincida con "${input.inquilino_o_propiedad}".`;
    }
    if ("sinContratoVigente" in resolucion) {
      return `${resolucion.sinContratoVigente} no tiene un contrato vigente actualmente.`;
    }

    const { contrato } = resolucion;
    const actualizado = await contratosRepo.actualizarFinaer(contrato.id, {
      finaerActivo: true,
      finaerNumeroPoliza: input.numero_poliza,
      finaerFechaInicio: input.fecha_inicio,
      finaerFechaVencimiento: input.fecha_vencimiento,
      finaerObservaciones: input.observaciones,
    });
    if (!actualizado) return "No se pudo cargar el Finaer de ese contrato.";

    return [
      "Seguro Finaer cargado.",
      `Inquilino: ${contrato.inquilino.nombreCompleto}`,
      `Propiedad: ${contrato.propiedad.direccion}`,
      actualizado.finaerNumeroPoliza ? `Póliza: ${actualizado.finaerNumeroPoliza}` : null,
      actualizado.finaerFechaVencimiento ? `Vencimiento: ${formatoFechaAR(actualizado.finaerFechaVencimiento)}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  },
});
