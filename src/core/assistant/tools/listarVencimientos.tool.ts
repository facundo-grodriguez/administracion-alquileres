import { z } from "zod";
import * as vencimientosService from "../../services/vencimientos.service.js";
import { formatoFechaAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

function diasTexto(dias: number): string {
  if (dias < 0) return `atrasado ${Math.abs(dias)} día(s)`;
  if (dias === 0) return "vence hoy";
  return `en ${dias} día(s)`;
}

export const listarVencimientosTool = defineTool({
  name: "listar_vencimientos",
  description:
    "Lista vencimientos dentro de un rango de fechas: fin de contratos, gastos de propiedad, Seguro Finaer " +
    "y contratos con actualización de alquiler pendiente. Usar para '¿qué contratos vencen este mes?', " +
    "'¿qué gastos tengo que pagar?', '¿qué vence esta semana?'. El filtro 'tipo' acota a un solo tipo.",
  inputSchema: z.object({
    desde: z.string().optional().describe("Fecha de inicio del rango, formato YYYY-MM-DD. Por defecto, hoy."),
    hasta: z
      .string()
      .optional()
      .describe("Fecha de fin del rango, formato YYYY-MM-DD. Por defecto, 30 días desde 'desde'."),
    tipo: z
      .enum(["contrato", "gasto", "finaer", "actualizacion_alquiler"])
      .optional()
      .describe("Filtrar por tipo. Si se omite, incluye todos."),
  }),
  run: async ({ desde, hasta, tipo }) => {
    const items = await vencimientosService.listarVencimientos(desde, hasta, tipo);
    if (items.length === 0) return "No hay vencimientos en ese rango de fechas.";
    return items
      .map((v) => {
        const monto = v.monto ? ` — ${formatoARS(v.monto)}` : "";
        return `- ${v.descripcion} — ${v.propiedad} — vence ${formatoFechaAR(v.fechaVencimiento)} (${diasTexto(v.diasRestantes)})${monto}`;
      })
      .join("\n");
  },
});
