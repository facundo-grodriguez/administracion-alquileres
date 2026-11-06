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
    "pasar fecha), 'dia_fijo' (cambia el día de todos los meses; pasar dia), 'monto' (monto aproximado), " +
    "'termina' (último mes o última cuota; pasar hasta_periodo, o nada para que siga sin fin) o 'baja' (dejar de " +
    "avisar; lo ya cargado se conserva). Para cuotas que terminan, preferir 'termina' antes que 'baja'. " +
    "Requiere el id (usar listar_vencimientos_servicios).",
  inputSchema: z.object({
    servicio_id: z.string(),
    accion: z.enum(["fecha_este_mes", "dia_fijo", "monto", "termina", "baja"]),
    fecha: z.string().optional().describe("YYYY-MM-DD, para fecha_este_mes"),
    periodo: z.string().optional().describe("Mes YYYY-MM al que aplica fecha_este_mes. Por defecto, el pendiente."),
    dia: z.number().int().min(1).max(31).optional().describe("Para dia_fijo"),
    monto: z.string().optional().describe("Para monto"),
    hasta_periodo: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional()
      .describe("Para termina: último mes YYYY-MM. Sin pasarlo, sigue todos los meses."),
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
      case "termina": {
        await serviciosService.cambiarHasta(input.servicio_id, input.hasta_periodo ?? null);
        return input.hasta_periodo
          ? `Listo. ${nombre} termina en ${formatoPeriodoAR(input.hasta_periodo)}: esa es la última cuota y después no te aviso más.\nLo pagado queda en el seguimiento.`
          : `Listo. ${nombre} sigue todos los meses, sin fecha de fin.`;
      }
      case "baja": {
        const hasta = await serviciosService.darDeBaja(input.servicio_id);
        return `Listo, di de baja ${nombre}. No te aviso más.${hasta ? `\nEl seguimiento queda guardado hasta ${formatoPeriodoAR(hasta)}.` : ""}`;
      }
    }
  },
});
