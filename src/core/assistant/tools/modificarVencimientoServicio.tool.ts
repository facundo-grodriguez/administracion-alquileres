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
    "avisar; lo ya cargado se conserva), 'fecha_pago' (corrige cuándo se pagó el último mes; pasar fecha), " +
    "'monto_pagado' (corrige cuánto se pagó o debitó un mes; pasar monto y, si sigue así, de_ahora_en_mas) o 'debito' " +
    "(debito_automatico true = se debita solo: no avisa y se marca pagado el día que vence; false = lo paga a mano). " +
    "Para cuotas que terminan, preferir 'termina' antes que 'baja'. " +
    "Requiere el id (usar listar_vencimientos_servicios).",
  inputSchema: z.object({
    servicio_id: z.string(),
    accion: z.enum(["fecha_este_mes", "dia_fijo", "monto", "termina", "baja", "fecha_pago", "debito", "monto_pagado"]),
    fecha: z
      .string()
      .optional()
      .describe("YYYY-MM-DD, para fecha_este_mes, o para fecha_pago (corrige cuándo se pagó el último mes pagado)"),
    periodo: z.string().optional().describe("Mes YYYY-MM al que aplica fecha_este_mes. Por defecto, el pendiente."),
    dia: z.number().int().min(1).max(31).optional().describe("Para dia_fijo"),
    monto: z
      .string()
      .optional()
      .describe("Para monto (aprox. de cada mes), monto_pagado (lo que se pagó o debitó) o debito (lo que se debita)"),
    debito_automatico: z
      .boolean()
      .optional()
      .describe("Para debito: true = se debita solo (no avisa, se marca pagado al vencer); false = lo paga a mano"),
    de_ahora_en_mas: z.boolean().optional().describe("Para monto_pagado: también es el monto de los meses que vienen"),
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
      case "debito": {
        const activo = input.debito_automatico !== false;
        const v = await serviciosService.cambiarDebito(input.servicio_id, activo, input.monto);
        if (!activo) return `Listo. ${nombre} lo pagás vos: te lo vuelvo a avisar en la agenda.`;
        return [
          `Listo. 🔄 ${nombre} se debita solo${v?.monto ? ` (${formatoARS(v.monto)})` : ""}.`,
          "No te lo aviso más: el día que vence lo marco pagado y te lo muestro en la agenda, con un botón por si fue otro monto.",
          v?.monto ? null : "⚠️ No tiene monto: cargalo así el débito queda con el monto.",
        ]
          .filter(Boolean)
          .join("\n");
      }
      case "monto_pagado": {
        if (!input.monto) return "Falta el monto.";
        const v = await serviciosService.cambiarMontoPagado(input.servicio_id, input.monto, {
          periodo: input.periodo,
          deAhoraEnMas: input.de_ahora_en_mas,
        });
        if (!v) return `${nombre} todavía no tiene ese mes pagado.`;
        return [
          `Listo. ${nombre} de ${formatoPeriodoAR(v.periodo)}: ${formatoARS(input.monto)}.`,
          v.propiedadId ? "También corregí el gasto de la propiedad." : null,
          input.de_ahora_en_mas ? `De ahora en más: ${formatoARS(input.monto)} por mes.` : null,
        ]
          .filter(Boolean)
          .join("\n");
      }
      case "fecha_pago": {
        if (!input.fecha) return "Falta la fecha en que lo pagaste.";
        const v = await serviciosService.cambiarFechaPago(input.servicio_id, input.fecha);
        if (!v) return `${nombre} todavía no tiene ningún mes pagado.`;
        return `Listo. ${nombre} de ${formatoPeriodoAR(v.periodo)}: pagado el ${formatoFechaAR(input.fecha)}.`;
      }
      case "baja": {
        const hasta = await serviciosService.darDeBaja(input.servicio_id);
        return `Listo, di de baja ${nombre}. No te aviso más.${hasta ? `\nEl seguimiento queda guardado hasta ${formatoPeriodoAR(hasta)}.` : ""}`;
      }
    }
  },
});
