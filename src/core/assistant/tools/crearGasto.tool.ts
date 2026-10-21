import { z } from "zod";
import * as gastosRepo from "../../repositories/gastosPropiedad.repository.js";
import * as propiedadesRepo from "../../repositories/propiedades.repository.js";
import * as gastosService from "../../services/gastosPropiedad.service.js";
import { formatoFechaAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

export const crearGastoTool = defineTool({
  name: "crear_gasto",
  description:
    "Registra un gasto de una propiedad: expensas, ABL, ARBA, luz, gas, agua, internet, " +
    "seguro hogar, arreglo/reparación (ej: plomero, electricista), u otro. Es el mismo lugar para cualquier gasto, no importa el rubro. " +
    "Requiere el ID de la propiedad (usar buscar_propiedad primero). Si el gasto ya está pagado, pasar " +
    "fecha_pago (y monto) para que entre directo en el balance.",
  inputSchema: z.object({
    propiedad_id: z.string(),
    tipo: z.enum(["expensas", "ABL", "ARBA", "luz", "gas", "agua", "internet", "seguro_hogar", "reparacion", "otro"]),
    fecha_vencimiento: z.string().describe("YYYY-MM-DD"),
    responsable: z.enum(["propietario", "inquilino"]).optional().describe("Quién paga este gasto, si se sabe"),
    monto: z.string().optional().describe("Ej: '30000'"),
    periodicidad: z.string().optional().describe("Ej: mensual, bimestral, anual"),
    observaciones: z.string().optional().describe("Ej: compañía y número de póliza, si es un seguro"),
    fecha_pago: z.string().optional().describe("YYYY-MM-DD, solo si ya está pagado"),
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
    const pagado = input.fecha_pago
      ? await gastosService.marcarPagado({ gastoId: gasto.id, fechaPago: input.fecha_pago })
      : undefined;
    const propiedad = await propiedadesRepo.obtenerPropiedadPorId(input.propiedad_id);
    return [
      "Gasto registrado.",
      propiedad ? `Propiedad: ${propiedad.direccion}` : null,
      `Tipo: ${gasto.tipo}`,
      `Vencimiento: ${formatoFechaAR(gasto.fechaVencimiento)}`,
      gasto.responsable ? `Responsable de pago: ${gasto.responsable}` : null,
      gasto.monto ? `Monto: ${formatoARS(gasto.monto)}` : null,
      pagado?.fechaPago
        ? `Pagado el ${formatoFechaAR(pagado.fechaPago)}${gasto.monto ? " — ya figura en el balance." : " — sin monto, no entra en el balance."}`
        : "Pendiente de pago: entra en el balance cuando lo marques como pagado.",
      `(id: ${gasto.id})`,
    ]
      .filter(Boolean)
      .join("\n");
  },
});
