import { z } from "zod";
import * as propiedadesRepo from "../../repositories/propiedades.repository.js";
import * as serviciosService from "../../services/serviciosVencimiento.service.js";
import { formatoFechaAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { DIAS_AVISO_PREVIO, nombreServicio } from "../../util/vencimientoServicio.js";
import { defineTool } from "../defineTool.js";

export const crearVencimientoServicioTool = defineTool({
  name: "crear_vencimiento_servicio",
  description:
    "Agenda el vencimiento mensual de un servicio para que el bot avise antes de que venza: luz, gas, agua, " +
    "internet, celular, expensas, ABL, ARBA, seguro, prepaga, tarjeta u otro. Puede ser personal del administrador " +
    "(sin propiedad) o de una propiedad (usar buscar_propiedad primero). Usar cuando diga cosas como " +
    "'la luz vence el 15', 'agendá que el celular vence los 10'. Es un recordatorio; si es de una propiedad, al marcarlo pagado se carga también como gasto de esa propiedad.",
  inputSchema: z.object({
    nombre: z.string().describe("Ej: Luz, Gas, Celular, Prepaga, Tarjeta Visa"),
    dia_vencimiento: z.number().int().min(1).max(31).describe("Día del mes en que vence"),
    propiedad_id: z.string().optional().describe("Solo si es de una propiedad; si no, es personal"),
    monto: z.string().optional().describe("Monto aproximado, ej: '12000'"),
  }),
  run: async (input) => {
    const propiedad = input.propiedad_id ? await propiedadesRepo.obtenerPropiedadPorId(input.propiedad_id) : undefined;
    if (input.propiedad_id && !propiedad) return "No encontré esa propiedad. Buscala de nuevo con buscar_propiedad.";
    const v = await serviciosService.crear({
      nombre: input.nombre.trim().replace(/^./, (c) => c.toUpperCase()),
      propiedadId: propiedad?.id ?? null,
      diaVencimiento: input.dia_vencimiento,
      monto: input.monto ?? null,
    });
    return [
      "Listo, agendé el vencimiento.",
      "",
      nombreServicio(v.nombre, v.propiedad),
      `Vence el día ${v.diaVencimiento} de cada mes`,
      `Próximo: ${formatoFechaAR(v.fechaVencimiento)}`,
      v.monto ? `Monto aprox.: ${formatoARS(v.monto)}` : null,
      `Te aviso ${DIAS_AVISO_PREVIO} días antes y el mismo día, hasta que lo marques como pagado.`,
      `(id: ${v.servicioId})`,
    ]
      .filter((l) => l !== null)
      .join("\n");
  },
});
