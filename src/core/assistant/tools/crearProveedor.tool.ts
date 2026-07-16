import { z } from "zod";
import * as proveedoresRepo from "../../repositories/proveedores.repository.js";
import { defineTool } from "../defineTool.js";

export const crearProveedorTool = defineTool({
  name: "crear_proveedor",
  description: "Da de alta un proveedor (plomero, electricista, gasista, etc.) para poder asignarlo a reparaciones.",
  inputSchema: z.object({
    nombre: z.string(),
    categoria: z.string().describe("Rubro, ej: plomero, electricista, gasista, pintor, cerrajero"),
    telefono: z.string().optional(),
    zona: z.string().optional(),
    horarios: z.string().optional().describe("Ej: Lun a Vie 9 a 18hs"),
    confianza: z.number().int().min(1).max(5).optional().describe("Nivel de confianza, 1 a 5"),
    observaciones: z.string().optional(),
  }),
  run: async (input) => {
    const proveedor = await proveedoresRepo.crearProveedor(input);
    return [
      "Proveedor registrado.",
      `Nombre: ${proveedor.nombre}`,
      `Rubro: ${proveedor.categoria}`,
      proveedor.zona ? `Zona: ${proveedor.zona}` : null,
      proveedor.telefono ? `Teléfono: ${proveedor.telefono}` : null,
      `(id: ${proveedor.id})`,
    ]
      .filter(Boolean)
      .join("\n");
  },
});
