import { z } from "zod";
import * as propiedadesRepo from "../../repositories/propiedades.repository.js";
import * as segurosRepo from "../../repositories/seguros.repository.js";
import { formatoFechaAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

export const crearSeguroTool = defineTool({
  name: "crear_seguro",
  description: "Registra un seguro de una propiedad. Requiere el ID de la propiedad (usar buscar_propiedad primero).",
  inputSchema: z.object({
    propiedad_id: z.string(),
    compania: z.string().describe("Compañía aseguradora, ej: La Caja, Sancor"),
    fecha_inicio: z.string().describe("YYYY-MM-DD"),
    fecha_vencimiento: z.string().describe("YYYY-MM-DD"),
    numero_poliza: z.string().optional(),
    costo: z.string().optional().describe("Costo del seguro, ej: '45000'"),
    observaciones: z.string().optional(),
  }),
  run: async (input) => {
    const seguro = await segurosRepo.crearSeguro({
      propiedadId: input.propiedad_id,
      compania: input.compania,
      fechaInicio: input.fecha_inicio,
      fechaVencimiento: input.fecha_vencimiento,
      numeroPoliza: input.numero_poliza,
      costo: input.costo,
      observaciones: input.observaciones,
    });
    const propiedad = await propiedadesRepo.obtenerPropiedadPorId(input.propiedad_id);
    return [
      "Seguro registrado.",
      propiedad ? `Propiedad: ${propiedad.direccion}` : null,
      `Compañía: ${seguro.compania}`,
      seguro.numeroPoliza ? `Póliza: ${seguro.numeroPoliza}` : null,
      `Vencimiento: ${formatoFechaAR(seguro.fechaVencimiento)}`,
      seguro.costo ? `Costo: ${formatoARS(seguro.costo)}` : null,
      `(id: ${seguro.id})`,
    ]
      .filter(Boolean)
      .join("\n");
  },
});
