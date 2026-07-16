import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "../db/client.js";
import { impuestosServicios } from "../db/schema.js";

export type ImpuestoServicio = typeof impuestosServicios.$inferSelect;
export type NuevoImpuestoServicio = typeof impuestosServicios.$inferInsert;

const conPropiedad = { propiedad: true } as const;

export async function crearImpuestoServicio(datos: NuevoImpuestoServicio): Promise<ImpuestoServicio> {
  const filas = await db.insert(impuestosServicios).values(datos).returning();
  return filas[0]!;
}

/** Impuestos/servicios por vencer que todavía no se marcaron como pagados. */
export async function listarImpuestosServiciosPorVencer(desde: string, hasta: string) {
  return db.query.impuestosServicios.findMany({
    where: and(
      gte(impuestosServicios.fechaVencimiento, desde),
      lte(impuestosServicios.fechaVencimiento, hasta),
      isNull(impuestosServicios.fechaPago),
    ),
    with: conPropiedad,
    orderBy: impuestosServicios.fechaVencimiento,
  });
}

export async function marcarPagado(
  id: string,
  fechaPago: string,
  monto?: string,
): Promise<ImpuestoServicio | undefined> {
  const filas = await db
    .update(impuestosServicios)
    .set({ fechaPago, ...(monto ? { montoEstimado: monto } : {}) })
    .where(eq(impuestosServicios.id, id))
    .returning();
  return filas[0];
}

export async function listarPorPropiedad(propiedadId: string) {
  return db.query.impuestosServicios.findMany({
    where: eq(impuestosServicios.propiedadId, propiedadId),
    with: conPropiedad,
    orderBy: impuestosServicios.fechaVencimiento,
  });
}
