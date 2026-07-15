import { z } from "zod";
import * as reparacionesRepo from "../../repositories/reparaciones.repository.js";
import { defineTool } from "../defineTool.js";

export const crearReparacionTool = defineTool({
  name: "crear_reparacion",
  description:
    "Registra una reparación de una propiedad. Requiere el ID de la propiedad (usar buscar_propiedad primero). " +
    "Por defecto queda en estado 'pendiente'.",
  inputSchema: z.object({
    propiedad_id: z.string(),
    fecha: z.string().describe("YYYY-MM-DD (cuándo se detectó o se hará)"),
    descripcion: z.string().describe("Qué hay que reparar"),
    costo: z.string().optional().describe("Costo estimado o real, ej: '80000'"),
    estado: z.enum(["pendiente", "en_curso", "completada"]).optional().describe("Por defecto 'pendiente'"),
  }),
  run: async (input) => {
    const reparacion = await reparacionesRepo.crearReparacion({
      propiedadId: input.propiedad_id,
      fecha: input.fecha,
      descripcion: input.descripcion,
      costo: input.costo,
      estado: input.estado ?? "pendiente",
    });
    return `Reparación registrada: [${reparacion.id}] ${reparacion.descripcion} (${reparacion.estado}).`;
  },
});
