import { z } from "zod";
import * as gastosService from "../../services/gastosPropiedad.service.js";
import { formatoFechaAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

export const marcarGastoPagadoTool = defineTool({
  name: "marcar_gasto_pagado",
  description:
    "Marca un gasto de propiedad (expensas, ABL, servicio, seguro, etc.) como pagado y refleja el monto " +
    "en el balance financiero de la propiedad. Requiere el ID del gasto (usar listar_gastos para encontrarlo). " +
    "Llamarla de nuevo sobre el mismo gasto corrige el pago (monto, fecha) en vez de duplicarlo.",
  inputSchema: z.object({
    gasto_id: z.string(),
    fecha_pago: z.string().describe("YYYY-MM-DD"),
    monto_pagado: z.string().optional().describe("Si no se pasa, usa el monto ya cargado"),
  }),
  run: async (input) => {
    const gasto = await gastosService.marcarPagado({
      gastoId: input.gasto_id,
      fechaPago: input.fecha_pago,
      monto: input.monto_pagado,
    });
    if (!gasto) return "No encontré ese gasto. Volvé a buscarlo con listar_gastos.";
    return [
      "Gasto marcado como pagado.",
      `Tipo: ${gasto.tipo}`,
      `Fecha de pago: ${formatoFechaAR(gasto.fechaPago!)}`,
      gasto.monto ? `Monto: ${formatoARS(gasto.monto)}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  },
});
