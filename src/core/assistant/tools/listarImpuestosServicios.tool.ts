import { z } from "zod";
import * as impuestosRepo from "../../repositories/impuestosServicios.repository.js";
import { formatoFechaAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

export const listarImpuestosServiciosTool = defineTool({
  name: "listar_impuestos_servicios",
  description:
    "Lista los impuestos/servicios (ABL, ARBA, luz, gas, agua, expensas, internet, otro) cargados para una " +
    "propiedad, con su responsable de pago si está cargado. A diferencia de listar_vencimientos, no se limita " +
    "a los que vencen pronto. Requiere el ID de la propiedad.",
  inputSchema: z.object({ propiedad_id: z.string() }),
  run: async ({ propiedad_id }) => {
    const items = await impuestosRepo.listarPorPropiedad(propiedad_id);
    if (items.length === 0) return "No hay impuestos/servicios cargados para esa propiedad.";
    return items
      .map((i) => {
        const responsable = i.responsable ? ` — responsable: ${i.responsable}` : "";
        const monto = i.montoEstimado ? ` — ${formatoARS(i.montoEstimado)}` : "";
        return `- ${i.tipo} — vence ${formatoFechaAR(i.fechaVencimiento)}${responsable}${monto}`;
      })
      .join("\n");
  },
});
