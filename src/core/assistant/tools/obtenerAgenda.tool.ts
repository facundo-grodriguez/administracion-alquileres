import { z } from "zod";
import { formatearResumenAgenda, obtenerResumenAgenda } from "../../services/agenda.service.js";
import { defineTool } from "../defineTool.js";

export const obtenerAgendaTool = defineTool({
  name: "obtener_agenda",
  description:
    "Devuelve el resumen completo de la agenda: alquileres a cobrar/pendientes/atrasados, " +
    "vencimientos próximos (contratos, seguros, impuestos/servicios) y reparaciones abiertas. " +
    "Usar para '¿qué tengo pendiente hoy?', '¿cómo viene la administración?', '¿qué vence pronto?'.",
  inputSchema: z.object({
    horizonte_dias: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Hasta cuántos días hacia adelante mirar los vencimientos. Por defecto 30."),
  }),
  run: async ({ horizonte_dias }) => {
    const resumen = await obtenerResumenAgenda(horizonte_dias ?? 30);
    return formatearResumenAgenda(resumen);
  },
});
