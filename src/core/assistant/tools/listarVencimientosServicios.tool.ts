import { z } from "zod";
import * as serviciosService from "../../services/serviciosVencimiento.service.js";
import { hoyISO } from "../../util/fecha.js";
import { defineTool } from "../defineTool.js";

export const listarVencimientosServiciosTool = defineTool({
  name: "listar_vencimientos_servicios",
  description:
    "Lista los vencimientos de servicios agendados (luz, gas, celular, prepaga...) de un mes: fecha, si ya se " +
    "pagó y monto aproximado. Usar para '¿qué servicios vencen este mes?', '¿pagué la luz?' y para encontrar el " +
    "id de un servicio antes de marcarlo pagado o modificarlo.",
  inputSchema: z.object({
    periodo: z.string().optional().describe("Mes YYYY-MM. Por defecto, el mes actual."),
  }),
  run: async ({ periodo }) => {
    const p = periodo ?? hoyISO().slice(0, 7);
    const items = await serviciosService.delMes(p);
    const texto = serviciosService.textoDelMes(items, p);
    if (items.length === 0) return texto;
    // Los ids van aparte, solo para encadenar herramientas (nunca se muestran).
    return `${texto}\n\n${items.map((v) => `(id ${v.nombre}${v.propiedad ? ` ${v.propiedad}` : ""}: ${v.servicioId})`).join("\n")}`;
  },
});
