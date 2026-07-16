import { z } from "zod";
import * as reparacionesService from "../../services/reparaciones.service.js";
import { defineTool } from "../defineTool.js";

export const adjuntarComprobanteReparacionTool = defineTool({
  name: "adjuntar_comprobante_reparacion",
  description:
    "Adjunta un comprobante o foto (link de Google Drive) a una reparación ya existente. " +
    "Requiere el ID de la reparación (usar listar_reparaciones para encontrarlo).",
  inputSchema: z.object({
    reparacion_id: z.string(),
    link: z.string().describe("URL de Google Drive (u otro) donde está el archivo"),
    nombre_archivo: z.string().optional().describe("Ej: Factura_Plomeria.pdf"),
    tipo_documento: z.enum(["comprobante", "foto", "factura", "otro"]).optional().describe("Por defecto 'comprobante'"),
    notas: z.string().optional(),
  }),
  run: async (input) => {
    const { reparacion } = await reparacionesService.adjuntarComprobante({
      reparacionId: input.reparacion_id,
      link: input.link,
      nombreArchivo: input.nombre_archivo,
      tipoDocumento: input.tipo_documento,
      notas: input.notas,
    });
    if (!reparacion) return `No se encontró la reparación ${input.reparacion_id}.`;
    return `Comprobante adjuntado a la reparación: ${reparacion.descripcion}.`;
  },
});
