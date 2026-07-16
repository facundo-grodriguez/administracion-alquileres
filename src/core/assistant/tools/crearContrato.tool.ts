import { z } from "zod";
import * as contratosRepo from "../../repositories/contratos.repository.js";
import * as personasRepo from "../../repositories/personas.repository.js";
import * as propiedadesRepo from "../../repositories/propiedades.repository.js";
import { formatoFechaAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

export const crearContratoTool = defineTool({
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
    const [propiedad, inquilino] = await Promise.all([
      propiedadesRepo.obtenerPropiedadPorId(input.propiedad_id),
      personasRepo.obtenerPersonaPorId(input.inquilino_id),
    ]);
    return [
      "Contrato registrado.",
      propiedad ? `Propiedad: ${propiedad.direccion}` : null,
      inquilino ? `Inquilino: ${inquilino.nombreCompleto}` : null,
      `Inicio: ${formatoFechaAR(contrato.fechaInicio)}`,
      `Finalización: ${formatoFechaAR(contrato.fechaFin)}`,
      `Alquiler inicial: ${formatoARS(contrato.valorAlquilerInicial)}`,
      `Vencimiento mensual: día ${contrato.diaVencimientoPago}`,
      `(id: ${contrato.id})`,
    ]
      .filter(Boolean)
      .join("\n");
  },
});
