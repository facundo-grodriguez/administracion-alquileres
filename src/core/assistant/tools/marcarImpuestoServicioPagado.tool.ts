import { z } from "zod";
import * as impuestosService from "../../services/impuestos.service.js";
import { formatoFechaAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

export const marcarImpuestoServicioPagadoTool = defineTool({
  name: "marcar_impuesto_servicio_pagado",
  description:
    "Marca un impuesto/servicio (ABL, ARBA, luz, gas, etc.) como pagado y refleja el gasto en el balance " +
    "financiero de la propiedad. Requiere el ID (usar listar_impuestos_servicios para encontrarlo). " +
    "Llamarla de nuevo sobre el mismo impuesto/servicio corrige el pago (monto, fecha) en vez de duplicarlo.",
  inputSchema: z.object({
    impuesto_servicio_id: z.string(),
    fecha_pago: z.string().describe("YYYY-MM-DD"),
    monto_pagado: z.string().optional().describe("Si no se pasa, usa el monto estimado ya cargado"),
  }),
  run: async (input) => {
    const item = await impuestosService.marcarPagado({
      impuestoServicioId: input.impuesto_servicio_id,
      fechaPago: input.fecha_pago,
      monto: input.monto_pagado,
    });
    if (!item) return "No encontré ese impuesto/servicio. Volvé a buscarlo con listar_impuestos_servicios.";
    return [
      "Impuesto/servicio marcado como pagado.",
      `Tipo: ${item.tipo}`,
      `Fecha de pago: ${formatoFechaAR(item.fechaPago!)}`,
      item.montoEstimado ? `Monto: ${formatoARS(item.montoEstimado)}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  },
});
