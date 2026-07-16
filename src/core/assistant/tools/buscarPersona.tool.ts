import { z } from "zod";
import * as personasRepo from "../../repositories/personas.repository.js";
import { defineTool } from "../defineTool.js";

export const buscarPersonaTool = defineTool({
  name: "buscar_persona",
  description: "Busca personas (inquilinos, propietarios o garantes) por nombre, DNI o teléfono.",
  inputSchema: z.object({
    query: z.string().describe("Nombre, DNI o teléfono a buscar"),
    rol: z.enum(["inquilino", "propietario", "garante"]).optional().describe("Filtrar por rol, si se conoce"),
  }),
  run: async ({ query, rol }) => {
    const personas = await personasRepo.buscarPersonas(query, rol);
    if (personas.length === 0) return `No se encontraron personas que coincidan con "${query}".`;
    return personas
      .map(
        (p) =>
          `- ${p.nombreCompleto}${p.dni ? ` (DNI ${p.dni})` : ""}${p.telefono ? ` — tel: ${p.telefono}` : ""} (id: ${p.id})`,
      )
      .join("\n");
  },
});
