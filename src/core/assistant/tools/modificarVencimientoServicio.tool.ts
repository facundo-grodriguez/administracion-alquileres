import { z } from "zod";
import * as serviciosService from "../../services/serviciosVencimiento.service.js";
import { formatoFechaAR, formatoPeriodoAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { nombreServicio } from "../../util/vencimientoServicio.js";
import { defineTool } from "../defineTool.js";

export const modificarVencimientoServicioTool = defineTool({
  name: "modificar_vencimiento_servicio",
  description:
    "Cambia un vencimiento de servicio agendado. accion: 'fecha_este_mes' (la factura de este mes vence otro día; " +
    "pasar fecha), 'dia_fijo' (cambia el día de todos los meses; pasar dia), 'monto' (monto aproximado) o 'baja' " +
    "(dejar de avisar). Requiere el id (usar listar_vencimientos_servicios).",
  inputSchema: z.object({
    servicio_id: z.string(),
    accion: z.enum(["fecha_este_mes", "dia_fijo", "monto", "baja"]),
    fecha: z.string().optional().describe("YYYY-MM-DD, para fecha_este_mes"),
    periodo: z.string().optional().describe("Mes YYYY-MM al que aplica fecha_este_mes. Por defecto, el pendiente."),
    dia: z.number().int().min(1).max(31).optional().describe("Para dia_fijo"),
    monto: z.string().optional().describe("Para monto"),
  }),
  run: async (input) => {
    const actual = await serviciosService.obtener(input.servicio_id, input.periodo);
    if (!actual) return "No encontré ese servicio. Buscalo con listar_vencimientos_servicios.";
    const nombre = nombreServicio(actual.nombre, actual.propiedad);
    switch (input.accion) {
      case "fecha_este_mes": {
        if (!input.fecha) return "Falta la fecha nueva del vencimiento.";
        const v = await serviciosService.cambiarFechaDelMes(input.servicio_id, actual.periodo, input.fecha);
        return `Listo. ${nombre} de ${formatoPeriodoAR(v!.periodo)} vence el ${formatoFechaAR(v!.fechaVencimiento)}.\nLos otros meses siguen venciendo el día ${v!.diaVencimiento}.`;
      }
      case "dia_fijo": {
        if (!input.dia) return "Falta el día nuevo.";
        const v = await serviciosService.cambiarDia(input.servicio_id, input.dia);
        return `Listo. ${nombre} ahora vence el día ${input.dia} de cada mes.\nPróximo: ${formatoFechaAR(v!.fechaVencimiento)}.`;
      }
      case "monto": {
        if (!input.monto) return "Falta el monto.";
        await serviciosService.cambiarMonto(input.servicio_id, input.monto);
        return `Listo. ${nombre}: monto aprox. ${formatoARS(input.monto)}.`;
      }
      case "baja":
        await serviciosService.darDeBaja(input.servicio_id);
        return `Listo, di de baja ${nombre}. No te aviso más.`;
    }
  },
});
