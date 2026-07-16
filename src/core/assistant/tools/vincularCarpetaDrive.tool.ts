import { z } from "zod";
import * as propiedadesRepo from "../../repositories/propiedades.repository.js";
import { defineTool } from "../defineTool.js";

export const vincularCarpetaDriveTool = defineTool({
  name: "vincular_carpeta_drive",
  description:
    "Vincula (o actualiza) el link a la carpeta general de Google Drive de una propiedad, distinto de los " +
    "documentos puntuales (usar crear_documento para esos). Requiere el ID de la propiedad.",
  inputSchema: z.object({ propiedad_id: z.string(), url: z.string().describe("Link de la carpeta de Drive") }),
  run: async ({ propiedad_id, url }) => {
    const propiedad = await propiedadesRepo.actualizarCarpetaDrive(propiedad_id, url);
    if (!propiedad) return "No encontré esa propiedad. Volvé a buscarla con buscar_propiedad.";
    return `Carpeta de Drive vinculada a ${propiedad.direccion}.`;
  },
});
