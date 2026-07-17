import { z } from "zod";
import * as gastosRepo from "../../repositories/gastosPropiedad.repository.js";
import { formatoFechaAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

export const listarGastosTool = defineTool({
  name: "listar_gastos",
  description:
    "Lista todos los gastos cargados de una propiedad (expensas, ABL, ARBA, servicios, seguros, etc.), " +
    "pagados o no. A diferencia de listar_vencimientos, no se limita a los que vencen pronto. " +
    "Requiere el ID de la propiedad.",
  inputSchema: z.object({ propiedad_id: z.string() }),
  run: async ({ propiedad_id }) => {
    const items = await gastosRepo.listarPorPropiedad(propiedad_id);
    if (items.length === 0) return "No hay gastos cargados para esa propiedad.";
    return items
      .map((g) => {
        const responsable = g.responsable ? ` — responsable: ${g.responsable}` : "";
        const monto = g.monto ? ` — ${formatoARS(g.monto)}` : "";
        const estado = g.fechaPago ? `pagado el ${formatoFechaAR(g.fechaPago)}` : "pendiente de pago";
        return `- ${g.tipo} — vence ${formatoFechaAR(g.fechaVencimiento)}${responsable}${monto} — ${estado} (id: ${g.id})`;
      })
      .join("\n");
  },
});
