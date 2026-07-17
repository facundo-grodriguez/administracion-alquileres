import { z } from "zod";
import * as gastosRepo from "../../repositories/gastosPropiedad.repository.js";
import * as propiedadesRepo from "../../repositories/propiedades.repository.js";
import { formatoFechaAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

export const crearGastoTool = defineTool({
  name: "crear_gasto",
  description:
    "Registra un gasto recurrente de una propiedad: expensas, ABL, ARBA, luz, gas, agua, internet, " +
    "seguro hogar, seguro incendio, u otro. Es el mismo lugar para cualquier gasto, no importa el rubro. " +
    "Requiere el ID de la propiedad (usar buscar_propiedad primero).",
  inputSchema: z.object({
    propiedad_id: z.string(),
    tipo: z.enum([
      "expensas",
      "ABL",
      "ARBA",
      "luz",
      "gas",
      "agua",
      "internet",
      "seguro_hogar",
      "seguro_incendio",
      "otro",
    ]),
    fecha_vencimiento: z.string().describe("YYYY-MM-DD"),
    responsable: z.enum(["propietario", "inquilino"]).optional().describe("Quién paga este gasto, si se sabe"),
    monto: z.string().optional().describe("Ej: '30000'"),
    periodicidad: z.string().optional().describe("Ej: mensual, bimestral, anual"),
    observaciones: z.string().optional().describe("Ej: compañía y número de póliza, si es un seguro"),
  }),
  run: async (input) => {
    const gasto = await gastosRepo.crearGasto({
      propiedadId: input.propiedad_id,
      tipo: input.tipo,
      fechaVencimiento: input.fecha_vencimiento,
      responsable: input.responsable,
      monto: input.monto,
      periodicidad: input.periodicidad,
      observaciones: input.observaciones,
    });
    const propiedad = await propiedadesRepo.obtenerPropiedadPorId(input.propiedad_id);
    return [
      "Gasto registrado.",
      propiedad ? `Propiedad: ${propiedad.direccion}` : null,
      `Tipo: ${gasto.tipo}`,
      `Vencimiento: ${formatoFechaAR(gasto.fechaVencimiento)}`,
      gasto.responsable ? `Responsable de pago: ${gasto.responsable}` : null,
      gasto.monto ? `Monto: ${formatoARS(gasto.monto)}` : null,
      `(id: ${gasto.id})`,
    ]
      .filter(Boolean)
      .join("\n");
  },
});
