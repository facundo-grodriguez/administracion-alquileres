import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
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

export async function obtenerPorId(id: string) {
  return db.query.gastosPropiedad.findFirst({ where: eq(gastosPropiedad.id, id), with: conPropiedad });
}

/** Los gastos más recientes (pagados o no), para elegir cuál corregir. */
export async function listarRecientes(limite = 30) {
  return db.query.gastosPropiedad.findMany({
    with: conPropiedad,
    orderBy: desc(gastosPropiedad.fechaVencimiento),
    limit: limite,
  });
}

/** Corrige datos de un gasto ya cargado. */
export async function actualizarGasto(
  id: string,
  datos: { tipo?: GastoPropiedad["tipo"]; monto?: string; fechaVencimiento?: string; fechaPago?: string },
): Promise<GastoPropiedad | undefined> {
  const filas = await db
    .update(gastosPropiedad)
    .set({ ...datos, ...(datos.fechaPago ? { estado: "pagado" as const } : {}), updatedAt: new Date() })
    .where(eq(gastosPropiedad.id, id))
    .returning();
  return filas[0];
}

export async function marcarPagado(id: string, fechaPago: string, monto?: string): Promise<GastoPropiedad | undefined> {
  const filas = await db
    .update(gastosPropiedad)
    .set({ fechaPago, estado: "pagado", ...(monto ? { monto } : {}) })
    .where(eq(gastosPropiedad.id, id))
    .returning();
  return filas[0];
}

/** Todos los gastos que todavía no se marcaron como pagados, sin importar la fecha. */
export async function listarPendientes() {
  return db.query.gastosPropiedad.findMany({
    where: isNull(gastosPropiedad.fechaPago),
    with: conPropiedad,
    orderBy: gastosPropiedad.fechaVencimiento,
  });
}
