import { z } from "zod";
import * as propiedadesRepo from "../../repositories/propiedades.repository.js";
import * as serviciosService from "../../services/serviciosVencimiento.service.js";
import { formatoFechaAR, formatoPeriodoAR, hoyISO } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { nombreServicio } from "../../util/vencimientoServicio.js";
import { defineTool } from "../defineTool.js";

export const crearVencimientoServicioTool = defineTool({
  name: "crear_vencimiento_servicio",
  description:
    "Agenda el vencimiento mensual de un servicio para que el bot avise antes de que venza: luz, gas, agua, " +
    "internet, celular, expensas, ABL, ARBA, seguro, prepaga, tarjeta u otro. Puede ser personal del administrador " +
    "(sin propiedad) o de una propiedad (usar buscar_propiedad primero). Usar cuando diga cosas como " +
    "'la luz vence el 15', 'agendá que el celular vence los 10'. Si son cuotas o termina en un mes ('el placard, última cuota en diciembre'), pasar hasta_periodo. Es un recordatorio; si es de una propiedad, al marcarlo pagado se carga también como gasto de esa propiedad.",
  inputSchema: z.object({
    nombre: z.string().describe("Ej: Luz, Gas, Celular, Prepaga, Tarjeta Visa"),
    dia_vencimiento: z.number().int().min(1).max(31).describe("Día del mes en que vence"),
    propiedad_id: z.string().optional().describe("Solo si es de una propiedad; si no, es personal"),
    monto: z.string().optional().describe("Monto aproximado, ej: '12000'"),
    hasta_periodo: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional()
      .describe("Último mes que vence (YYYY-MM), si son cuotas o termina. Si no, todos los meses sin fin."),
    debito_automatico: z
      .boolean()
      .optional()
      .describe("true si se debita solo: no avisa y se marca pagado el día que vence (con el monto)."),
  }),
  run: async (input) => {
    const propiedad = input.propiedad_id ? await propiedadesRepo.obtenerPropiedadPorId(input.propiedad_id) : undefined;
    if (input.propiedad_id && !propiedad) return "No encontré esa propiedad. Buscala de nuevo con buscar_propiedad.";
    const v = await serviciosService.crear({
      nombre: input.nombre.trim().replace(/^./, (c) => c.toUpperCase()),
      propiedadId: propiedad?.id ?? null,
      diaVencimiento: input.dia_vencimiento,
      monto: input.monto ?? null,
      hastaPeriodo: input.hasta_periodo ?? null,
      debitoDesde: input.debito_automatico ? hoyISO() : null,
    });
    return [
      "Listo, agendé el vencimiento.",
      "",
      nombreServicio(v.nombre, v.propiedad),
      `Vence el día ${v.diaVencimiento} de cada mes`,
      `Próximo: ${formatoFechaAR(v.fechaVencimiento)}`,
      v.monto ? `Monto aprox.: ${formatoARS(v.monto)}` : null,
      v.hastaPeriodo ? `Última cuota: ${formatoPeriodoAR(v.hastaPeriodo)}` : null,
      v.debito
        ? "🔄 Se debita solo: no te aviso, lo marco pagado el día que vence y te lo muestro en la agenda."
        : "Te aparece en la agenda de cada mañana hasta que lo marques como pagado.",
      `(id: ${v.servicioId})`,
    ]
      .filter((l) => l !== null)
      .join("\n");
  },
});
