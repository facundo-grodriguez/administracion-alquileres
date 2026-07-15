import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "../db/client.js";
import { impuestosServicios } from "../db/schema.js";

export type ImpuestoServicio = typeof impuestosServicios.$inferSelect;
export type NuevoImpuestoServicio = typeof impuestosServicios.$inferInsert;

const conPropiedad = { propiedad: true } as const;

export async function crearImpuestoServicio(datos: NuevoImpuestoServicio): Promise<ImpuestoServicio> {
  const filas = await db.insert(impuestosServicios).values(datos).returning();
  return filas[0]!;
}

export async function listarImpuestosServiciosPorVencer(desde: string, hasta: string) {
  return db.query.impuestosServicios.findMany({
    where: and(gte(impuestosServicios.fechaVencimiento, desde), lte(impuestosServicios.fechaVencimiento, hasta)),
    with: conPropiedad,
    orderBy: impuestosServicios.fechaVencimiento,
  });
}

export async function listarPorPropiedad(propiedadId: string) {
  return db.query.impuestosServicios.findMany({
    where: eq(impuestosServicios.propiedadId, propiedadId),
    with: conPropiedad,
    orderBy: impuestosServicios.fechaVencimiento,
  });
}
