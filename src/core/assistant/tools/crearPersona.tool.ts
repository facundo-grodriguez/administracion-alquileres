import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import * as personasRepo from "../../repositories/personas.repository.js";

export const crearPersonaTool = betaZodTool({
  name: "crear_persona",
  description:
    "Da de alta una persona (inquilino, propietario o garante). El rol no se guarda acá: " +
    "se define después según dónde se la referencie (propietario de una propiedad, inquilino de un contrato, etc.).",
  inputSchema: z.object({
    nombre_completo: z.string().describe("Nombre y apellido"),
    dni: z.string().optional(),
    telefono: z.string().optional(),
    email: z.string().optional(),
    direccion: z.string().optional(),
    notas: z.string().optional(),
  }),
  run: async (input) => {
    const persona = await personasRepo.crearPersona({
      nombreCompleto: input.nombre_completo,
      dni: input.dni,
      telefono: input.telefono,
      email: input.email,
      direccion: input.direccion,
      notas: input.notas,
    });
    return `Persona creada: [${persona.id}] ${persona.nombreCompleto}`;
  },
});
