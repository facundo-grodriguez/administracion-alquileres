import { z } from "zod";
import * as propiedadesRepo from "../../repositories/propiedades.repository.js";
import * as movimientosService from "../../services/movimientos.service.js";
import { defineTool } from "../defineTool.js";

export const obtenerBalanceFinancieroTool = defineTool({
  name: "obtener_balance_financiero",
  description:
    "Calcula el balance financiero (ingresos - gastos) de una propiedad, o de todas si no se especifica, " +
    "en un rango de fechas. Por defecto, del 1° del mes actual a hoy. Incluye automáticamente los pagos de " +
    "alquiler cobrados y los costos de reparaciones, además de los movimientos manuales.",
  inputSchema: z.object({
    propiedad_id: z.string().optional().describe("Si se omite, calcula el balance de todas las propiedades juntas"),
    desde: z.string().optional().describe("YYYY-MM-DD, por defecto el 1° del mes actual"),
    hasta: z.string().optional().describe("YYYY-MM-DD, por defecto hoy"),
  }),
  run: async ({ propiedad_id, desde, hasta }) => {
    const propiedad = propiedad_id ? await propiedadesRepo.obtenerPropiedadPorId(propiedad_id) : undefined;
    if (propiedad_id && !propiedad) return `No se encontró la propiedad ${propiedad_id}.`;

    const balance = await movimientosService.calcularBalance({ propiedadId: propiedad_id, desde, hasta });
    return movimientosService.formatearBalance(balance, propiedad?.direccion);
  },
});
