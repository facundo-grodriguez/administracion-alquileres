import { desc, eq, ne } from "drizzle-orm";
import { db } from "../db/client.js";
import { reparaciones } from "../db/schema.js";

export type Reparacion = typeof reparaciones.$inferSelect;
export type NuevaReparacion = typeof reparaciones.$inferInsert;

const conRelaciones = { propiedad: true, proveedor: true, comprobante: true } as const;

export async function crearReparacion(datos: NuevaReparacion): Promise<Reparacion> {
  const filas = await db.insert(reparaciones).values(datos).returning();
  return filas[0]!;
}

export async function adjuntarComprobante(reparacionId: string, documentoId: string): Promise<Reparacion | undefined> {
  const filas = await db
    .update(reparaciones)
    .set({ comprobanteDocumentoId: documentoId })
    .where(eq(reparaciones.id, reparacionId))
    .returning();
  return filas[0];
}

/** Reparaciones no terminadas (estado ≠ completada). */
export async function listarAbiertas() {
  return db.query.reparaciones.findMany({
    where: ne(reparaciones.estado, "completada"),
    with: conRelaciones,
    orderBy: desc(reparaciones.fecha),
  });
}

export async function listarTodas() {
  return db.query.reparaciones.findMany({
    with: conRelaciones,
    orderBy: desc(reparaciones.fecha),
  });
}

export async function marcarCompletada(id: string): Promise<Reparacion | undefined> {
  const filas = await db.update(reparaciones).set({ estado: "completada" }).where(eq(reparaciones.id, id)).returning();
  return filas[0];
}
