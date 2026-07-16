import { z } from "zod";
import * as documentosRepo from "../../repositories/documentos.repository.js";
import { defineTool } from "../defineTool.js";

export const crearDocumentoTool = defineTool({
  name: "crear_documento",
  description:
    "Registra el link (Google Drive u otro) de un documento puntual de una propiedad: contrato, póliza, factura, " +
    "comprobante, foto, inventario, etc. Requiere el ID de la propiedad (usar buscar_propiedad primero). " +
    "Para el link a la carpeta general de Drive de la propiedad, usar vincular_carpeta_drive en cambio.",
  inputSchema: z.object({
    propiedad_id: z.string(),
    tipo_documento: z.enum(["contrato", "poliza", "recibo", "factura", "comprobante", "foto", "inventario", "otro"]),
    nombre_archivo: z.string().describe("Ej: Contrato_2026.pdf"),
    link: z.string().describe("URL de Google Drive (u otro) donde está el archivo"),
    notas: z.string().optional(),
  }),
  run: async (input) => {
    const documento = await documentosRepo.crearDocumento({
      entidadTipo: "propiedad",
      entidadId: input.propiedad_id,
      tipoDocumento: input.tipo_documento,
      nombreArchivo: input.nombre_archivo,
      storagePath: input.link,
      notas: input.notas,
    });
    return `Documento registrado: [${documento.id}] ${documento.nombreArchivo} (${documento.tipoDocumento}).`;
  },
});
