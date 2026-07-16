import { z } from "zod";
import * as movimientosRepo from "../../repositories/movimientosFinancieros.repository.js";
import * as propiedadesRepo from "../../repositories/propiedades.repository.js";
import { formatoFechaAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

export const crearMovimientoFinancieroTool = defineTool({
  name: "crear_movimiento_financiero",
  description:
    "Registra manualmente un ingreso o gasto de una propiedad que no se genera automáticamente " +
    "(los pagos de alquiler y los costos de reparaciones ya se reflejan solos). Requiere el ID de la propiedad.",
  inputSchema: z.object({
    propiedad_id: z.string(),
    tipo: z.enum(["ingreso", "gasto"]),
    categoria: z
      .string()
      .describe("Ej: alquiler, reparación, seguro, ABL, ARBA, luz, gas, agua, expensas, internet, otro"),
    monto: z.string().describe("Ej: '45000'"),
    fecha: z.string().describe("YYYY-MM-DD"),
    descripcion: z.string().optional(),
  }),
  run: async (input) => {
    const movimiento = await movimientosRepo.crearMovimiento({
      propiedadId: input.propiedad_id,
      tipo: input.tipo,
      categoria: input.categoria,
      monto: input.monto,
      fecha: input.fecha,
      descripcion: input.descripcion,
    });
    const propiedad = await propiedadesRepo.obtenerPropiedadPorId(input.propiedad_id);
    return [
      `${movimiento.tipo === "ingreso" ? "Ingreso" : "Gasto"} registrado.`,
      propiedad ? `Propiedad: ${propiedad.direccion}` : null,
      `Categoría: ${movimiento.categoria}`,
      `Monto: ${formatoARS(movimiento.monto)}`,
      `Fecha: ${formatoFechaAR(movimiento.fecha)}`,
      movimiento.descripcion ? `Detalle: ${movimiento.descripcion}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  },
});
