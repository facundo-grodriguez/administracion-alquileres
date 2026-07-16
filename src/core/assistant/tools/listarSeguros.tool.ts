import { z } from "zod";
import * as segurosRepo from "../../repositories/seguros.repository.js";
import { formatoFechaAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

export const listarSegurosTool = defineTool({
  name: "listar_seguros",
  description:
    "Lista los seguros cargados para una propiedad, pagados o no. A diferencia de listar_vencimientos, " +
    "no se limita a los que vencen pronto. Requiere el ID de la propiedad.",
  inputSchema: z.object({ propiedad_id: z.string() }),
  run: async ({ propiedad_id }) => {
    const items = await segurosRepo.listarSegurosPorPropiedad(propiedad_id);
    if (items.length === 0) return "No hay seguros cargados para esa propiedad.";
    return items
      .map((s) => {
        const estado = s.fechaPago ? `pagado el ${formatoFechaAR(s.fechaPago)}` : "pendiente de pago";
        const costo = s.costo ? ` — ${formatoARS(s.costo)}` : "";
        return `- ${s.compania}${s.numeroPoliza ? ` (póliza ${s.numeroPoliza})` : ""} — vence ${formatoFechaAR(s.fechaVencimiento)} — ${estado}${costo} (id: ${s.id})`;
      })
      .join("\n");
  },
});
