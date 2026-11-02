import { z } from "zod";
import * as serviciosService from "../../services/serviciosVencimiento.service.js";
import { formatoFechaAR, formatoPeriodoAR, hoyISO } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { nombreServicio } from "../../util/vencimientoServicio.js";
import { defineTool } from "../defineTool.js";

export const marcarServicioPagadoTool = defineTool({
  name: "marcar_servicio_pagado",
  description:
    "Marca como pagado el vencimiento de un servicio agendado (deja de avisar ese mes). Requiere el id del " +
    "servicio (usar listar_vencimientos_servicios). Si no se pasa el mes, usa el vencimiento pendiente.",
  inputSchema: z.object({
    servicio_id: z.string(),
    periodo: z.string().optional().describe("Mes YYYY-MM del vencimiento. Por defecto, el pendiente."),
    fecha_pago: z.string().optional().describe("YYYY-MM-DD. Por defecto, hoy."),
    monto: z.string().optional().describe("Lo que se pagó, si se sabe"),
  }),
  run: async (input) => {
    const pendiente = await serviciosService.obtener(input.servicio_id, input.periodo);
    if (!pendiente) return "No encontré ese servicio. Buscalo con listar_vencimientos_servicios.";
    const v = await serviciosService.marcarPagado(
      input.servicio_id,
      pendiente.periodo,
      input.fecha_pago ?? hoyISO(),
      input.monto,
    );
    return [
      "Listo, quedó pagado.",
      "",
      `${nombreServicio(v!.nombre, v!.propiedad)} — ${formatoPeriodoAR(v!.periodo)}`,
      `Pagado el ${formatoFechaAR(v!.fechaPago!)}`,
      v!.monto ? `Monto: ${formatoARS(v!.monto)}` : null,
      "No te aviso más por este mes.",
    ]
      .filter((l) => l !== null)
      .join("\n");
  },
});
