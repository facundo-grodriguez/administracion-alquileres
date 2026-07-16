import { z } from "zod";
import * as propiedadesRepo from "../../repositories/propiedades.repository.js";
import { defineTool } from "../defineTool.js";

export const buscarPropiedadTool = defineTool({
  name: "buscar_propiedad",
  description:
    "Busca propiedades por dirección, zona, nombre del propietario o del inquilino actual. " +
    "Usar para encontrar el ID de una propiedad antes de consultar o modificar sus datos.",
  inputSchema: z.object({
    query: z.string().describe("Texto a buscar: dirección, zona, o nombre de propietario/inquilino"),
  }),
  run: async ({ query }) => {
    const propiedades = await propiedadesRepo.buscarPropiedades(query);
    if (propiedades.length === 0) return `No se encontraron propiedades que coincidan con "${query}".`;
    return propiedades
      .map(
        (p) =>
          `- ${p.direccion}${p.zona ? ` (${p.zona})` : ""} — propietario: ${p.propietario.nombreCompleto} (id: ${p.id})`,
      )
      .join("\n");
  },
});
