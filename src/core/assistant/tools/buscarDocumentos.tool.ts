import { z } from "zod";
import * as documentosRepo from "../../repositories/documentos.repository.js";
import * as propiedadesRepo from "../../repositories/propiedades.repository.js";
import { defineTool } from "../defineTool.js";

export const buscarDocumentosTool = defineTool({
  name: "buscar_documentos",
  description:
    "Lista los documentos puntuales de una propiedad (contrato, póliza, fotos, etc.) y muestra el link a la " +
    "carpeta general de Drive si está vinculada. Requiere el ID de la propiedad.",
  inputSchema: z.object({
    propiedad_id: z.string(),
    tipo_documento: z
      .enum(["contrato", "poliza", "recibo", "factura", "comprobante", "foto", "inventario", "otro"])
      .optional(),
  }),
  run: async ({ propiedad_id, tipo_documento }) => {
    const propiedad = await propiedadesRepo.obtenerPropiedadPorId(propiedad_id);
    if (!propiedad) return `No se encontró la propiedad ${propiedad_id}.`;

    const documentos = await documentosRepo.listarPorEntidad("propiedad", propiedad_id, tipo_documento);
    const carpeta = propiedad.carpetaDriveUrl ? `📁 Carpeta general: ${propiedad.carpetaDriveUrl}\n\n` : "";

    if (documentos.length === 0) return `${carpeta}No hay documentos puntuales cargados para ${propiedad.direccion}.`;

    const lista = documentos
      .map(
        (d) =>
          `- [${d.id}] ${d.nombreArchivo} (${d.tipoDocumento}) — ${d.storagePath}${d.notas ? ` — ${d.notas}` : ""}`,
      )
      .join("\n");
    return `${carpeta}Documentos de ${propiedad.direccion} (${documentos.length}):\n${lista}`;
  },
});
