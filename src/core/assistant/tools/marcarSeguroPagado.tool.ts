import { z } from "zod";
import * as segurosService from "../../services/seguros.service.js";
import { formatoFechaAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

export const marcarSeguroPagadoTool = defineTool({
  name: "marcar_seguro_pagado",
  description:
    "Marca un seguro como pagado y refleja el gasto en el balance financiero de la propiedad. " +
    "Requiere el ID del seguro (usar listar_seguros o buscar_documentos para encontrarlo). " +
    "Llamarla de nuevo sobre el mismo seguro corrige el pago (monto, fecha) en vez de duplicarlo.",
  inputSchema: z.object({
    seguro_id: z.string(),
    fecha_pago: z.string().describe("YYYY-MM-DD"),
    monto_pagado: z.string().optional().describe("Si no se pasa, usa el costo ya cargado del seguro"),
  }),
  run: async (input) => {
    const seguro = await segurosService.marcarPagado({
      seguroId: input.seguro_id,
      fechaPago: input.fecha_pago,
      monto: input.monto_pagado,
    });
    if (!seguro) return "No encontré ese seguro. Volvé a buscarlo con listar_seguros.";
    return [
      "Seguro marcado como pagado.",
      `Compañía: ${seguro.compania}`,
      `Fecha de pago: ${formatoFechaAR(seguro.fechaPago!)}`,
      seguro.costo ? `Monto: ${formatoARS(seguro.costo)}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  },
});
