import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "../db/client.js";
import { actualizacionesContrato } from "../db/schema.js";

export type ActualizacionContrato = typeof actualizacionesContrato.$inferSelect;
export type NuevaActualizacionContrato = typeof actualizacionesContrato.$inferInsert;

export async function obtenerUltima(contratoId: string): Promise<ActualizacionContrato | undefined> {
  return db.query.actualizacionesContrato.findFirst({
    where: eq(actualizacionesContrato.contratoId, contratoId),
    orderBy: desc(actualizacionesContrato.fechaVigencia),
  });
}

/** La actualización vigente a una fecha dada (la más reciente con fechaVigencia <= fecha). */
export async function obtenerVigenteAl(
  contratoId: string,
  fechaISO: string,
): Promise<ActualizacionContrato | undefined> {
  return db.query.actualizacionesContrato.findFirst({
    where: and(
      eq(actualizacionesContrato.contratoId, contratoId),
      lte(actualizacionesContrato.fechaVigencia, fechaISO),
    ),
    orderBy: desc(actualizacionesContrato.fechaVigencia),
  });
}

/** Inserta el período o, si ya existía (mismo contrato+fecha), actualiza el valor. */
export async function upsert(datos: NuevaActualizacionContrato): Promise<ActualizacionContrato> {
  const filas = await db
    .insert(actualizacionesContrato)
    .values(datos)
    .onConflictDoUpdate({
      target: [actualizacionesContrato.contratoId, actualizacionesContrato.fechaVigencia],
      set: { valorNuevo: datos.valorNuevo, indiceAplicado: datos.indiceAplicado },
    })
    .returning();
  return filas[0]!;
}
