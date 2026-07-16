import { z } from "zod";
import * as impuestosRepo from "../../repositories/impuestosServicios.repository.js";
import { defineTool } from "../defineTool.js";

export const crearImpuestoServicioTool = defineTool({
  name: "crear_impuesto_servicio",
  description:
    "Registra un impuesto o servicio de una propiedad (ABL, ARBA, luz, gas, agua, expensas, internet, cuponera, etc.) " +
    "con su fecha de vencimiento y, opcionalmente, quién es responsable de pagarlo (propietario o inquilino). " +
    "Requiere el ID de la propiedad (usar buscar_propiedad primero). " +
    "Para renovación de cuponeras usar tipo 'otro' y aclararlo en observaciones.",
  inputSchema: z.object({
    propiedad_id: z.string(),
    tipo: z.enum(["ABL", "ARBA", "luz", "gas", "agua", "expensas", "internet", "otro"]),
    fecha_vencimiento: z.string().describe("YYYY-MM-DD"),
    numero_cuenta: z.string().optional(),
    periodicidad: z.string().optional().describe("Ej: mensual, bimestral, anual"),
    monto_estimado: z.string().optional().describe("Ej: '30000'"),
    responsable: z.enum(["propietario", "inquilino"]).optional().describe("Quién paga esta obligación, si se sabe"),
    observaciones: z.string().optional(),
  }),
  run: async (input) => {
    const item = await impuestosRepo.crearImpuestoServicio({
      propiedadId: input.propiedad_id,
      tipo: input.tipo,
      fechaVencimiento: input.fecha_vencimiento,
      numeroCuenta: input.numero_cuenta,
      periodicidad: input.periodicidad,
      montoEstimado: input.monto_estimado,
      responsable: input.responsable,
      observaciones: input.observaciones,
    });
    const responsableTxt = item.responsable ? ` — responsable: ${item.responsable}` : "";
    return `Impuesto/servicio registrado: [${item.id}] ${item.tipo}, vence ${item.fechaVencimiento}${responsableTxt}.`;
  },
});
