import { z } from "zod";
import * as pagosService from "../../services/pagos.service.js";
import { formatoFechaAR, formatoPeriodoAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

const ESTADO_TEXTO: Record<string, string> = {
  pagado: "PAGADO",
  pendiente: "PENDIENTE (todavía no venció)",
  atrasado: "ATRASADO",
  parcial: "PAGO PARCIAL",
};

export const obtenerEstadoPagoTool = defineTool({
  name: "obtener_estado_pago",
  description:
    "Consulta si el alquiler de un inquilino o propiedad está pago para un período dado. " +
    "Usar cuando el usuario pregunta '¿está pago el alquiler de X?' o similares.",
  inputSchema: z.object({
    inquilino_o_propiedad: z.string().describe("Nombre del inquilino o dirección de la propiedad"),
    periodo: z.string().optional().describe("Mes/año en formato YYYY-MM. Si se omite, se usa el mes actual."),
  }),
  run: async ({ inquilino_o_propiedad, periodo }) => {
    const resultado = await pagosService.obtenerEstadoPago(inquilino_o_propiedad, periodo);

    switch (resultado.tipo) {
      case "ambiguo":
        return `Hay más de una coincidencia para "${inquilino_o_propiedad}". Pedile al usuario que aclare cuál: ${resultado.candidatos.join(", ")}.`;
      case "no_encontrado":
        return `No se encontró ningún inquilino ni propiedad que coincida con "${inquilino_o_propiedad}".`;
      case "sin_contrato_vigente":
        return `${resultado.nombre} no tiene un contrato vigente actualmente.`;
      case "resuelto":
        return [
          `Inquilino: ${resultado.inquilino}`,
          `Propiedad: ${resultado.propiedad}`,
          `Período: ${formatoPeriodoAR(resultado.periodo)}`,
          `Estado: ${ESTADO_TEXTO[resultado.estado]}`,
          `Vencimiento: ${formatoFechaAR(resultado.fechaVencimiento)}`,
          `Monto: ${formatoARS(resultado.monto)}`,
          resultado.fechaPago ? `Fecha de pago: ${formatoFechaAR(resultado.fechaPago)}` : null,
          `(id: ${resultado.contratoId})`,
        ]
          .filter(Boolean)
          .join("\n");
    }
  },
});
