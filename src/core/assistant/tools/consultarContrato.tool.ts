import { z } from "zod";
import * as actualizacionesRepo from "../../repositories/actualizacionesContrato.repository.js";
import type { ContratoConRelaciones } from "../../services/pagos.service.js";
import * as pagosService from "../../services/pagos.service.js";
import { formatoFechaAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

/** Detalle de un contrato en lenguaje de negocio (lo usan la tool y el menú de Consultas). */
export async function detalleContratoTexto(contrato: ContratoConRelaciones): Promise<string> {
  const ultimaActualizacion = await actualizacionesRepo.obtenerUltima(contrato.id);
  const valorVigente = ultimaActualizacion?.valorNuevo ?? contrato.valorAlquilerInicial;

  const garantes =
    contrato.garantes.length === 0
      ? "sin garantes cargados"
      : contrato.garantes.map((g) => g.persona.nombreCompleto).join(", ");

  const actualizacionTxt = contrato.frecuenciaActualizacion
    ? `${contrato.frecuenciaActualizacion}${contrato.indiceActualizacion ? ` por ${contrato.indiceActualizacion}` : " (sin índice asignado)"}`
    : "sin configurar";

  const finaerTxt = contrato.finaerActivo
    ? `cargado${contrato.finaerNumeroPoliza ? ` (póliza ${contrato.finaerNumeroPoliza})` : ""}${contrato.finaerFechaVencimiento ? `, vence ${formatoFechaAR(contrato.finaerFechaVencimiento)}` : ""}`
    : "no cargado";

  return [
    `Propiedad: ${contrato.propiedad.direccion}`,
    `Inquilino: ${contrato.inquilino.nombreCompleto}`,
    `Garantes: ${garantes}`,
    `Inicio: ${formatoFechaAR(contrato.fechaInicio)}`,
    `Finalización: ${formatoFechaAR(contrato.fechaFin)}`,
    `Alquiler inicial: ${formatoARS(contrato.valorAlquilerInicial)}`,
    ultimaActualizacion
      ? `Valor vigente: ${formatoARS(valorVigente)} (desde ${formatoFechaAR(ultimaActualizacion.fechaVigencia)}${ultimaActualizacion.indiceAplicado === "manual" ? ", cargado a mano" : ""})`
      : null,
    `Actualización: ${actualizacionTxt}`,
    `Seguro Finaer: ${finaerTxt}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const consultarContratoTool = defineTool({
  name: "consultar_contrato",
  description:
    "Muestra el detalle completo de un contrato: propiedad, inquilino, garantes, fechas, valor vigente, " +
    "actualización (índice/frecuencia) y Seguro Finaer. Usar cuando el usuario pide ver o consultar un contrato.",
  inputSchema: z.object({
    inquilino_o_propiedad: z.string().describe("Nombre del inquilino o dirección de la propiedad"),
  }),
  run: async ({ inquilino_o_propiedad }) => {
    const resolucion = await pagosService.resolverContrato(inquilino_o_propiedad);
    if ("ambiguo" in resolucion) {
      return `Hay más de una coincidencia para "${inquilino_o_propiedad}". Pedile al usuario que aclare cuál: ${resolucion.ambiguo.join(", ")}.`;
    }
    if ("noEncontrado" in resolucion) {
      return `No se encontró ningún inquilino ni propiedad que coincida con "${inquilino_o_propiedad}".`;
    }
    if ("sinContratoVigente" in resolucion) {
      return `${resolucion.sinContratoVigente} no tiene un contrato vigente actualmente.`;
    }

    return detalleContratoTexto(resolucion.contrato);
  },
});
