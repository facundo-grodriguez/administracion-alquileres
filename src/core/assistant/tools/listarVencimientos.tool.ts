import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import * as vencimientosService from "../../services/vencimientos.service.js";

export const listarVencimientosTool = betaZodTool({
  name: "listar_vencimientos",
  description:
    "Lista los contratos vigentes cuyo vencimiento cae dentro de un rango de fechas. " +
    "Usar para '¿qué contratos vencen este mes?' o consultas similares sobre vencimiento de contrato.",
  inputSchema: z.object({
    desde: z.string().optional().describe("Fecha de inicio del rango, formato YYYY-MM-DD. Por defecto, hoy."),
    hasta: z
      .string()
      .optional()
      .describe("Fecha de fin del rango, formato YYYY-MM-DD. Por defecto, 30 días desde 'desde'."),
  }),
  run: async ({ desde, hasta }) => {
    const contratos = await vencimientosService.listarVencimientos(desde, hasta);
    if (contratos.length === 0) return "No hay contratos que venzan en ese rango de fechas.";
    return contratos.map((c) => `- ${c.inquilino} — ${c.propiedad} (vence ${c.fechaFin})`).join("\n");
  },
});
