import { z } from "zod";
import * as propiedadesRepo from "../../repositories/propiedades.repository.js";
import * as proveedoresRepo from "../../repositories/proveedores.repository.js";
import * as reparacionesService from "../../services/reparaciones.service.js";
import { formatoFechaAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

export const crearReparacionTool = defineTool({
  name: "crear_reparacion",
  description:
    "Registra una reparación de una propiedad. Requiere el ID de la propiedad (usar buscar_propiedad primero). " +
    "Si se conoce el proveedor que la hace, pasá su ID (usar buscar_proveedor primero). " +
    "Por defecto queda en estado 'pendiente'.",
  inputSchema: z.object({
    propiedad_id: z.string(),
    proveedor_id: z.string().optional().describe("ID del proveedor que hace el trabajo, si se conoce"),
    fecha: z.string().describe("YYYY-MM-DD (cuándo se detectó o se hará)"),
    descripcion: z.string().describe("Qué hay que reparar"),
    costo: z.string().optional().describe("Costo estimado o real, ej: '80000'"),
    estado: z.enum(["pendiente", "en_curso", "completada"]).optional().describe("Por defecto 'pendiente'"),
  }),
  run: async (input) => {
    const reparacion = await reparacionesService.crearReparacion({
      propiedadId: input.propiedad_id,
      proveedorId: input.proveedor_id,
      fecha: input.fecha,
      descripcion: input.descripcion,
      costo: input.costo,
      estado: input.estado ?? "pendiente",
    });
    const [propiedad, proveedor] = await Promise.all([
      propiedadesRepo.obtenerPropiedadPorId(input.propiedad_id),
      input.proveedor_id ? proveedoresRepo.obtenerProveedorPorId(input.proveedor_id) : Promise.resolve(undefined),
    ]);
    return [
      "Reparación registrada.",
      propiedad ? `Propiedad: ${propiedad.direccion}` : null,
      `Descripción: ${reparacion.descripcion}`,
      `Fecha: ${formatoFechaAR(reparacion.fecha)}`,
      proveedor ? `Proveedor: ${proveedor.nombre}` : null,
      reparacion.costo ? `Costo: ${formatoARS(reparacion.costo)}` : null,
      `Estado: ${reparacion.estado}`,
      `(id: ${reparacion.id})`,
    ]
      .filter(Boolean)
      .join("\n");
  },
});
