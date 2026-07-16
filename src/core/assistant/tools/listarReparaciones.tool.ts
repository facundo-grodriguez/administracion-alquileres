import { z } from "zod";
import * as reparacionesRepo from "../../repositories/reparaciones.repository.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

export const listarReparacionesTool = defineTool({
  name: "listar_reparaciones",
  description:
    "Lista las reparaciones. Por defecto solo las abiertas (pendientes o en curso); " +
    "con solo_abiertas=false devuelve todas, incluidas las completadas.",
  inputSchema: z.object({
    solo_abiertas: z.boolean().optional().describe("Por defecto true (solo abiertas)."),
  }),
  run: async ({ solo_abiertas }) => {
    const incluirTodas = solo_abiertas === false;
    const reparaciones = incluirTodas ? await reparacionesRepo.listarTodas() : await reparacionesRepo.listarAbiertas();

    if (reparaciones.length === 0) {
      return incluirTodas ? "No hay reparaciones registradas." : "No hay reparaciones abiertas.";
    }

    return reparaciones
      .map((r) => {
        const costo = r.costo ? ` — ${formatoARS(r.costo)}` : "";
        const proveedor = r.proveedor ? ` — proveedor: ${r.proveedor.nombre}` : "";
        const comprobante = r.comprobante ? " 📎" : "";
        return `- [${r.id}] ${r.descripcion} — ${r.propiedad.direccion} — ${r.estado} (${r.fecha})${costo}${proveedor}${comprobante}`;
      })
      .join("\n");
  },
});
