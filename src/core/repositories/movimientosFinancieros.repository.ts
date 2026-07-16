import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "../db/client.js";
import { movimientosFinancieros } from "../db/schema.js";

export type MovimientoFinanciero = typeof movimientosFinancieros.$inferSelect;
export type NuevoMovimientoFinanciero = typeof movimientosFinancieros.$inferInsert;

export async function crearMovimiento(datos: NuevoMovimientoFinanciero): Promise<MovimientoFinanciero> {
  const filas = await db.insert(movimientosFinancieros).values(datos).returning();
  return filas[0]!;
}

export async function listarPorRango(filtros: { propiedadId?: string; desde: string; hasta: string }) {
  const condiciones = [
    gte(movimientosFinancieros.fecha, filtros.desde),
    lte(movimientosFinancieros.fecha, filtros.hasta),
  ];
  if (filtros.propiedadId) condiciones.push(eq(movimientosFinancieros.propiedadId, filtros.propiedadId));
  return db.query.movimientosFinancieros.findMany({
    where: and(...condiciones),
    orderBy: movimientosFinancieros.fecha,
  });
}

/**
 * Inserta o actualiza (si ya existe una fila con esa referenciaTipo+referenciaId) — idempotente,
 * para que volver a registrar un pago/reparación no duplique el movimiento asociado.
 */
export async function upsertPorReferencia(datos: NuevoMovimientoFinanciero): Promise<MovimientoFinanciero> {
  if (datos.referenciaTipo && datos.referenciaId) {
    const existente = await db.query.movimientosFinancieros.findFirst({
      where: and(
        eq(movimientosFinancieros.referenciaTipo, datos.referenciaTipo),
        eq(movimientosFinancieros.referenciaId, datos.referenciaId),
      ),
    });
    if (existente) {
      const filas = await db
        .update(movimientosFinancieros)
        .set(datos)
        .where(eq(movimientosFinancieros.id, existente.id))
        .returning();
      return filas[0]!;
    }
  }
  return crearMovimiento(datos);
}
