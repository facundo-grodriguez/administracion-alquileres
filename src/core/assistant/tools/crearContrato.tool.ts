import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import * as contratosRepo from "../../repositories/contratos.repository.js";

export const crearContratoTool = betaZodTool({
  name: "crear_contrato",
  description:
    "Da de alta un contrato de alquiler. Requiere IDs de propiedad e inquilino ya existentes " +
    "(usar buscar_propiedad / buscar_persona / crear_persona primero).",
  inputSchema: z.object({
    propiedad_id: z.string(),
    inquilino_id: z.string(),
    garante_ids: z.array(z.string()).optional().describe("IDs de las personas garantes, si hay"),
    fecha_inicio: z.string().describe("YYYY-MM-DD"),
    fecha_fin: z.string().describe("YYYY-MM-DD"),
    valor_alquiler: z.string().describe("Valor mensual del alquiler, ej: '150000'"),
    dia_vencimiento_pago: z
      .number()
      .int()
      .min(1)
      .max(28)
      .optional()
      .describe("Día del mes en que vence el pago. Por defecto 10."),
    indice_actualizacion: z.string().optional().describe("Ej: IPC, ICL"),
    deposito: z.string().optional(),
    observaciones: z.string().optional(),
  }),
  run: async (input) => {
    const contrato = await contratosRepo.crearContrato(
      {
        propiedadId: input.propiedad_id,
        inquilinoId: input.inquilino_id,
        fechaInicio: input.fecha_inicio,
        fechaFin: input.fecha_fin,
        valorAlquilerInicial: input.valor_alquiler,
        diaVencimientoPago: input.dia_vencimiento_pago ?? 10,
        indiceActualizacion: input.indice_actualizacion,
        deposito: input.deposito,
        observaciones: input.observaciones,
      },
      input.garante_ids ?? [],
    );
    return `Contrato creado: [${contrato.id}], vigente desde ${contrato.fechaInicio} hasta ${contrato.fechaFin}.`;
  },
});
