import { z } from "zod";
import * as serviciosService from "../../services/serviciosVencimiento.service.js";
import { formatoFechaAR, formatoPeriodoAR, hoyISO } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { entraEnBalance } from "../../util/responsableGasto.js";
import { nombreServicio } from "../../util/vencimientoServicio.js";
import { defineTool } from "../defineTool.js";

export const marcarServicioPagadoTool = defineTool({
  name: "marcar_servicio_pagado",
  description:
    "Marca como pagado el vencimiento de un servicio agendado (deja de avisar ese mes). Requiere el id del " +
    "servicio (usar listar_vencimientos_servicios). Si no se pasa el mes, usa el vencimiento pendiente. " +
    "Si el servicio es de una propiedad, también se carga como gasto de esa propiedad: pedí el monto real que " +
    "se pagó, y si la propiedad está alquilada preguntá si lo pagó el propietario (resta del balance) o el inquilino.",
  inputSchema: z.object({
    servicio_id: z.string(),
    periodo: z.string().optional().describe("Mes YYYY-MM del vencimiento. Por defecto, el pendiente."),
    fecha_pago: z.string().optional().describe("YYYY-MM-DD. Por defecto, hoy."),
    monto: z.string().optional().describe("Lo que se pagó, si se sabe"),
    responsable: z
      .enum(["propietario", "inquilino"])
      .optional()
      .describe("Solo servicios de una propiedad: quién lo pagó. Por defecto, el propietario."),
  }),
  run: async (input) => {
    const pendiente = await serviciosService.obtener(input.servicio_id, input.periodo);
    if (!pendiente) return "No encontré ese servicio. Buscalo con listar_vencimientos_servicios.";
    const v = await serviciosService.marcarPagado(
      input.servicio_id,
      pendiente.periodo,
      input.fecha_pago ?? hoyISO(),
      input.monto,
      input.responsable,
    );
    if (!v) return "No encontré ese servicio. Buscalo con listar_vencimientos_servicios.";
    const gasto = v.gasto;
    return [
      "Listo, quedó pagado.",
      "",
      `${nombreServicio(v.nombre, v.propiedad)} — ${formatoPeriodoAR(v.periodo)}`,
      `Pagado el ${formatoFechaAR(v.fechaPago!)}`,
      v.monto ? `Monto: ${formatoARS(v.monto)}` : null,
      gasto
        ? !entraEnBalance(gasto)
          ? `Quedó como gasto de ${v.propiedad} pagado por el inquilino: no resta del balance.`
          : gasto.monto
            ? `Quedó como gasto de ${v.propiedad}: ya resta del balance.`
            : `Quedó como gasto de ${v.propiedad}, pero sin monto no entra en el balance.`
        : null,
      "No te aviso más por este mes.",
    ]
      .filter((l) => l !== null)
      .join("\n");
  },
});
