import { z } from "zod";
import type { ContratoConRelaciones } from "../../services/pagos.service.js";
import * as pagosService from "../../services/pagos.service.js";
import { formatoFechaAR, formatoPeriodoAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

const ESTADO: Record<string, string> = {
  pagado: "✅ pagado",
  pendiente: "🕓 pendiente",
  atrasado: "⚠️ sin pago registrado",
  parcial: "◐ pago parcial",
};

/** Historial mes a mes de un contrato (lo usan la tool y el menú de Consultas). */
export async function historialPagosTexto(
  contrato: ContratoConRelaciones,
): Promise<{ texto: string; hayDeuda: boolean }> {
  const historial = await pagosService.historialPagos(contrato);
  if (historial.length === 0) {
    return { texto: `El contrato de ${contrato.inquilino.nombreCompleto} todavía no empezó.`, hayDeuda: false };
  }
  const lineas = historial.map((p) => {
    const pago = p.fechaPago && p.estado === "pagado" ? ` el ${formatoFechaAR(p.fechaPago)}` : "";
    return `  • ${formatoPeriodoAR(p.periodo)}: ${formatoARS(p.monto)} — ${ESTADO[p.estado]}${pago}`;
  });
  const sinPagar = historial.filter((p) => p.estado === "atrasado" || p.estado === "parcial");
  const total = sinPagar.reduce((acc, p) => acc + Number(p.monto), 0);
  return {
    texto: [
      `🧾 Pagos de ${contrato.inquilino.nombreCompleto} — ${contrato.propiedad.direccion}`,
      lineas.join("\n"),
      sinPagar.length > 0
        ? `Sin pago registrado: ${sinPagar.length} mes(es), ${formatoARS(total)}.`
        : "Todo registrado. ✅",
    ].join("\n\n"),
    hayDeuda: sinPagar.length > 0,
  };
}

export const historialPagosTool = defineTool({
  name: "historial_pagos",
  description:
    "Muestra mes a mes, desde el inicio del contrato, qué alquileres figuran pagados y cuáles no. Usar cuando " +
    "el usuario pregunta por pagos de meses anteriores, deudas o el historial de un inquilino.",
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
    return (await historialPagosTexto(resolucion.contrato)).texto;
  },
});
