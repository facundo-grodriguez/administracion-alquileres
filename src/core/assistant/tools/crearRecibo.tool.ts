import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import * as pagosService from "../../services/pagos.service.js";
import { formatoARS } from "../../util/formato.js";

export const crearReciboTool = betaZodTool({
  name: "crear_recibo",
  description:
    "Registra el pago de un período de alquiler (marca el período como pagado). Requiere el ID del contrato.",
  inputSchema: z.object({
    contrato_id: z.string(),
    periodo: z.string().describe("Mes/año en formato YYYY-MM"),
    monto: z.string().describe("Monto pagado, ej: '150000'"),
    fecha_pago: z.string().describe("YYYY-MM-DD"),
    medio_pago: z.string().optional().describe("Ej: transferencia, efectivo"),
  }),
  run: async (input) => {
    const pago = await pagosService.crearRecibo({
      contratoId: input.contrato_id,
      periodo: input.periodo,
      monto: input.monto,
      fechaPago: input.fecha_pago,
      medioPago: input.medio_pago,
    });
    if (!pago) return "No se pudo registrar el pago.";
    return `Pago registrado: período ${input.periodo}, ${formatoARS(pago.monto)}, cobrado el ${pago.fechaPago}.`;
  },
});
