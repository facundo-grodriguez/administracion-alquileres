import { z } from "zod";
import * as pagosService from "../../services/pagos.service.js";
import { formatoPeriodoAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

export const crearReciboTool = defineTool({
  name: "crear_recibo",
  description:
    "Registra el pago de un período de alquiler (marca el período como pagado). Requiere el ID del contrato " +
    "(usar obtener_estado_pago primero para resolverlo a partir del nombre del inquilino o la propiedad). " +
    "Si el período ya tenía un pago registrado, llamarla de nuevo CORRIGE ese pago (monto, fecha, medio de pago) " +
    "en vez de duplicarlo — usarla también para corregir un monto mal cargado.",
  inputSchema: z.object({
    contrato_id: z.string(),
    periodo: z.string().describe("Mes/año en formato YYYY-MM"),
    monto: z.string().describe("Monto pagado, ej: '150000'"),
    fecha_pago: z.string().describe("YYYY-MM-DD"),
    medio_pago: z.string().optional().describe("Ej: transferencia, efectivo"),
    observaciones: z.string().optional(),
  }),
  run: async (input) => {
    const { pago, contrato, anterior } = await pagosService.crearRecibo({
      contratoId: input.contrato_id,
      periodo: input.periodo,
      monto: input.monto,
      fechaPago: input.fecha_pago,
      medioPago: input.medio_pago,
      observaciones: input.observaciones,
    });
    if (!pago) return "No se pudo registrar el pago.";
    return [
      anterior ? `✏️ Pago corregido (antes: ${formatoARS(anterior.monto)}).` : "Pago registrado.",
      `Inquilino: ${contrato.inquilino.nombreCompleto}`,
      `Propiedad: ${contrato.propiedad.direccion}`,
      `Período: ${formatoPeriodoAR(input.periodo)}`,
      `Importe: ${formatoARS(pago.monto)}`,
      `Medio de pago: ${pago.medioPago ?? "no especificado"}`,
      pago.observaciones ? `Observaciones: ${pago.observaciones}` : null,
      "Estado: Pagado",
    ]
      .filter(Boolean)
      .join("\n");
  },
});
