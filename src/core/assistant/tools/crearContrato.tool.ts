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
    "(usar buscar_propiedad / buscar_persona / crear_persona primero). Siempre preguntá la frecuencia " +
    "de actualización del alquiler, no la asumas. Si el contrato tiene Seguro Finaer, se puede cargar acá " +
    "o después con cargar_seguro_finaer.",
  inputSchema: z.object({
    propiedad_id: z.string(),
    inquilino_id: z.string(),
    garante_ids: z.array(z.string()).optional().describe("IDs de las personas garantes, si hay"),
    fecha_inicio: z.string().describe("YYYY-MM-DD"),
    fecha_fin: z.string().describe("YYYY-MM-DD"),
    valor_alquiler: z.string().describe("Valor mensual del alquiler, ej: '150000'"),
    frecuencia_actualizacion: z
      .enum(["mensual", "trimestral", "semestral", "anual"])
      .describe("Cada cuánto se actualiza el alquiler. Preguntala siempre, no la asumas."),
    indice_actualizacion: z.enum(["IPC", "ICL"]).optional().describe("Índice con el que se actualiza el alquiler"),
    dia_vencimiento_pago: z
      .number()
      .int()
      .min(1)
      .max(28)
      .optional()
      .describe("Día del mes en que vence el pago. Por defecto 10."),
    deposito: z.string().optional(),
    observaciones: z.string().optional(),
    finaer_numero_poliza: z.string().optional().describe("Si tiene Seguro Finaer, su número de póliza"),
    finaer_fecha_inicio: z.string().optional().describe("YYYY-MM-DD"),
    finaer_fecha_vencimiento: z.string().optional().describe("YYYY-MM-DD"),
  }),
  run: async (input) => {
    const contrato = await contratosRepo.crearContrato(
      {
        propiedadId: input.propiedad_id,
        inquilinoId: input.inquilino_id,
        fechaInicio: input.fecha_inicio,
        fechaFin: input.fecha_fin,
        valorAlquilerInicial: input.valor_alquiler,
        frecuenciaActualizacion: input.frecuencia_actualizacion,
        indiceActualizacion: input.indice_actualizacion,
        diaVencimientoPago: input.dia_vencimiento_pago ?? 10,
        deposito: input.deposito,
        observaciones: input.observaciones,
        finaerActivo: Boolean(input.finaer_numero_poliza || input.finaer_fecha_vencimiento),
        finaerNumeroPoliza: input.finaer_numero_poliza,
        finaerFechaInicio: input.finaer_fecha_inicio,
        finaerFechaVencimiento: input.finaer_fecha_vencimiento,
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
      `Actualización: ${contrato.frecuenciaActualizacion}${contrato.indiceActualizacion ? ` por ${contrato.indiceActualizacion}` : ""}`,
      contrato.finaerActivo ? "Seguro Finaer: cargado" : null,
      `(id: ${contrato.id})`,
    ]
      .filter(Boolean)
      .join("\n");
  },
});
