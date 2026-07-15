import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "../db/client.js";
import { seguros } from "../db/schema.js";

export type Seguro = typeof seguros.$inferSelect;
export type NuevoSeguro = typeof seguros.$inferInsert;

const conPropiedad = { propiedad: true } as const;

export async function crearSeguro(datos: NuevoSeguro): Promise<Seguro> {
  const filas = await db.insert(seguros).values(datos).returning();
  return filas[0]!;
}

export async function listarSegurosPorVencer(desde: string, hasta: string) {
  return db.query.seguros.findMany({
    where: and(gte(seguros.fechaVencimiento, desde), lte(seguros.fechaVencimiento, hasta)),
    with: conPropiedad,
    orderBy: seguros.fechaVencimiento,
  });
}

export async function listarSegurosPorPropiedad(propiedadId: string) {
  return db.query.seguros.findMany({
    where: eq(seguros.propiedadId, propiedadId),
    with: conPropiedad,
    orderBy: seguros.fechaVencimiento,
  });
}
