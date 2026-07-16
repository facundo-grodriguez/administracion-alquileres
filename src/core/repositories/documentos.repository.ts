import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { documentos } from "../db/schema.js";

export type Documento = typeof documentos.$inferSelect;
export type NuevoDocumento = typeof documentos.$inferInsert;
export type TipoDocumento = Documento["tipoDocumento"];

export async function crearDocumento(datos: NuevoDocumento): Promise<Documento> {
  const filas = await db.insert(documentos).values(datos).returning();
  return filas[0]!;
}

export async function listarPorEntidad(entidadTipo: string, entidadId: string, tipoDocumento?: TipoDocumento) {
  const condiciones = [eq(documentos.entidadTipo, entidadTipo), eq(documentos.entidadId, entidadId)];
  if (tipoDocumento) condiciones.push(eq(documentos.tipoDocumento, tipoDocumento));
  return db.query.documentos.findMany({ where: and(...condiciones), orderBy: desc(documentos.subidoEn) });
}
