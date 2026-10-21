import { z } from "zod";
import * as contratosRepo from "../../repositories/contratos.repository.js";
import * as personasRepo from "../../repositories/personas.repository.js";
import * as propiedadesRepo from "../../repositories/propiedades.repository.js";
import { formatoFechaAR, sumarDiasISO } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

/**
 * Si la propiedad ya tiene un contrato vigente que se pisa con esas fechas, devuelve el aviso
 * (y no se debe crear el contrato). Una renovación que arranca después del fin del actual pasa.
 */
export async function validarSuperposicion(
  propiedadId: string,
  fechaInicio: string,
  fechaFin: string,
): Promise<string | undefined> {
  if (fechaFin < fechaInicio) return "⚠️ No cargué el contrato: la fecha de finalización es anterior a la de inicio.";
  const superpuestos = await contratosRepo.buscarSuperpuestos(propiedadId, fechaInicio, fechaFin);
  const actual = superpuestos[0];
  if (!actual) return undefined;
  return [
    `⚠️ No cargué el contrato: ${actual.propiedad.direccion} ya tiene un contrato vigente con ` +
      `${actual.inquilino.nombreCompleto} del ${formatoFechaAR(actual.fechaInicio)} al ${formatoFechaAR(actual.fechaFin)}.`,
    `Si es una renovación, el contrato nuevo tiene que empezar a partir del ${formatoFechaAR(sumarDiasISO(actual.fechaFin, 1))}.`,
  ].join("\n");
}

export const crearContratoTool = defineTool({
  name: "crear_contrato",
  description:
    "Da de alta un contrato de alquiler. Requiere IDs de propiedad e inquilino ya existentes " +
    "(usar buscar_propiedad / buscar_persona / crear_persona primero). Siempre preguntá la frecuencia " +
    "de actualización del alquiler, no la asumas. Si el contrato tiene Seguro Finaer, se puede cargar acá " +
    "o después con cargar_seguro_finaer. No permite cargar un contrato que se pise en fechas con otro vigente " +
    "de la misma propiedad: si pasa, avisale al usuario tal cual lo que devuelve.",
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
    const aviso = await validarSuperposicion(input.propiedad_id, input.fecha_inicio, input.fecha_fin);
    if (aviso) return aviso;

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
