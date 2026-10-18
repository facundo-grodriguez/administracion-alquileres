import { z } from "zod";
import type { Contrato } from "../../repositories/contratos.repository.js";
import * as contratosRepo from "../../repositories/contratos.repository.js";
import * as actualizacionService from "../../services/actualizacionAlquiler.service.js";
import * as pagosService from "../../services/pagos.service.js";
import { formatoFechaAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

/** Lógica compartida entre la tool (chat) y el flujo guiado (botones). */
export async function registrarAlquilerActual(
  contrato: Contrato & { inquilino: { nombreCompleto: string }; propiedad: { direccion: string } },
  monto?: string,
): Promise<string> {
  const resultado = await actualizacionService.registrarManual(contrato, { monto });
  if (resultado.tipo === "todavia_no_corresponde") {
    return (
      `El contrato de ${contrato.inquilino.nombreCompleto} todavía no llegó a su primer ajuste ` +
      `(${formatoFechaAR(resultado.proximaFecha)}), así que no hay ninguna actualización pendiente para registrar.`
    );
  }
  const cambio =
    resultado.valorNuevo === resultado.valorAnterior
      ? `Alquiler: ${formatoARS(resultado.valorNuevo)} (sin cambios)`
      : `Alquiler: ${formatoARS(resultado.valorAnterior)} → ${formatoARS(resultado.valorNuevo)}`;
  return [
    "Actualización registrada. Ya no figura como pendiente en la agenda.",
    `Inquilino: ${contrato.inquilino.nombreCompleto}`,
    `Propiedad: ${contrato.propiedad.direccion}`,
    cambio,
    `Vigente desde: ${formatoFechaAR(resultado.fechaVigencia)}`,
    `Próximo ajuste: ${formatoFechaAR(resultado.proximaFecha)}`,
  ].join("\n");
}

export async function registrarAlquilerActualPorId(contratoId: string, monto?: string): Promise<string> {
  const contrato = await contratosRepo.buscarContratoPorId(contratoId);
  if (!contrato) return "No encontré ese contrato.";
  return registrarAlquilerActual(contrato, monto);
}

export const registrarAlquilerActualTool = defineTool({
  name: "registrar_alquiler_actual",
  description:
    "Registra a mano cuánto se está pagando HOY de alquiler en un contrato, cuando el aumento ya se aplicó " +
    "por fuera del bot (ej: 'Juan ya paga 450000', 'cargué el contrato con el precio inicial pero ahora pagan más'). " +
    "Deja ese monto como valor vigente para los cobros y saca la alerta de actualización pendiente hasta el " +
    "próximo ajuste. Sin monto, marca la actualización como hecha manteniendo el valor actual (sirve para " +
    "descartar la alerta). No consulta ninguna API.",
  inputSchema: z.object({
    inquilino_o_propiedad: z.string().describe("Nombre del inquilino o dirección de la propiedad"),
    monto: z
      .string()
      .optional()
      .describe("Monto mensual que se paga hoy, ej: '450000'. Omitir para mantener el actual."),
  }),
  run: async ({ inquilino_o_propiedad, monto }) => {
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
    return registrarAlquilerActual(resolucion.contrato, monto);
  },
});
