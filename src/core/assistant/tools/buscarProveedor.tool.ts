import { z } from "zod";
import * as proveedoresRepo from "../../repositories/proveedores.repository.js";
import { defineTool } from "../defineTool.js";

export const buscarProveedorTool = defineTool({
  name: "buscar_proveedor",
  description:
    "Busca proveedores por nombre, rubro/categoría o zona. Sin filtros, lista todos los proveedores cargados. " +
    "Usar para encontrar el ID de un proveedor antes de asignarlo a una reparación.",
  inputSchema: z.object({
    query: z.string().optional().describe("Nombre a buscar"),
    categoria: z.string().optional().describe("Rubro, ej: plomero, electricista"),
    zona: z.string().optional(),
  }),
  run: async (filtros) => {
    const proveedores = await proveedoresRepo.buscarProveedores(filtros);
    if (proveedores.length === 0) return "No se encontraron proveedores que coincidan.";
    return proveedores
      .map((p) => {
        const confianza = p.confianza ? ` — confianza: ${p.confianza}/5` : "";
        return `- [${p.id}] ${p.nombre} (${p.categoria})${p.zona ? ` — ${p.zona}` : ""}${p.telefono ? ` — tel: ${p.telefono}` : ""}${confianza}`;
      })
      .join("\n");
  },
});
