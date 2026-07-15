import { z } from "zod";
import * as propiedadesRepo from "../../repositories/propiedades.repository.js";
import { defineTool } from "../defineTool.js";

export const crearPropiedadTool = defineTool({
  name: "crear_propiedad",
  description:
    "Da de alta una propiedad. Requiere el ID del propietario (usar buscar_persona o crear_persona primero).",
  inputSchema: z.object({
    direccion: z.string(),
    propietario_id: z.string().describe("ID de la persona propietaria"),
    zona: z.string().optional(),
    tipo: z.string().optional().describe("Ej: departamento, casa, local"),
    observaciones: z.string().optional(),
  }),
  run: async (input) => {
    const propiedad = await propiedadesRepo.crearPropiedad({
      direccion: input.direccion,
      propietarioId: input.propietario_id,
      zona: input.zona,
      tipo: input.tipo,
      observaciones: input.observaciones,
    });
    return `Propiedad creada: [${propiedad.id}] ${propiedad.direccion}`;
  },
});
