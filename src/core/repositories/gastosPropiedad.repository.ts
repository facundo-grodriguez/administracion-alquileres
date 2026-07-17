import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "../db/client.js";
import { gastosPropiedad } from "../db/schema.js";

export type GastoPropiedad = typeof gastosPropiedad.$inferSelect;
export type NuevoGastoPropiedad = typeof gastosPropiedad.$inferInsert;

const conPropiedad = { propiedad: true } as const;

export async function crearGasto(datos: NuevoGastoPropiedad): Promise<GastoPropiedad> {
  const filas = await db.insert(gastosPropiedad).values(datos).returning();
  return filas[0]!;
}

export async function listarPorPropiedad(propiedadId: string) {
  return db.query.gastosPropiedad.findMany({
    where: eq(gastosPropiedad.propiedadId, propiedadId),
    with: conPropiedad,
    orderBy: gastosPropiedad.fechaVencimiento,
  });
}

/** Gastos por vencer que todavía no se marcaron como pagados. */
export async function listarPorVencer(desde: string, hasta: string) {
  return db.query.gastosPropiedad.findMany({
    where: and(
      gte(gastosPropiedad.fechaVencimiento, desde),
      lte(gastosPropiedad.fechaVencimiento, hasta),
      isNull(gastosPropiedad.fechaPago),
    ),
    with: conPropiedad,
    orderBy: gastosPropiedad.fechaVencimiento,
  });
}

export async function marcarPagado(id: string, fechaPago: string, monto?: string): Promise<GastoPropiedad | undefined> {
  const filas = await db
    .update(gastosPropiedad)
    .set({ fechaPago, estado: "pagado", ...(monto ? { monto } : {}) })
    .where(eq(gastosPropiedad.id, id))
    .returning();
  return filas[0];
}
