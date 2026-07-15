import { z } from "zod";
import * as reparacionesRepo from "../../repositories/reparaciones.repository.js";
import { defineTool } from "../defineTool.js";

export const marcarReparacionCompletadaTool = defineTool({
  name: "marcar_reparacion_completada",
  description:
    "Marca una reparación como completada. Requiere el ID de la reparación (usar listar_reparaciones para encontrarlo).",
  inputSchema: z.object({
    reparacion_id: z.string(),
  }),
  run: async ({ reparacion_id }) => {
    const reparacion = await reparacionesRepo.marcarCompletada(reparacion_id);
    if (!reparacion) return `No se encontró la reparación ${reparacion_id}.`;
    return `Reparación marcada como completada: ${reparacion.descripcion}.`;
  },
});
