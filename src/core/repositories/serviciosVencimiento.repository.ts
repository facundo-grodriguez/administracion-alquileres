import { asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { serviciosVencimiento, serviciosVencimientoMes } from "../db/schema.js";

export type ServicioVencimiento = typeof serviciosVencimiento.$inferSelect;
export type MesServicio = typeof serviciosVencimientoMes.$inferSelect;

const conDetalle = { propiedad: true, meses: true } as const;

export async function crear(datos: {
  nombre: string;
  propiedadId?: string | null;
  diaVencimiento: number;
  monto?: string | null;
}): Promise<ServicioVencimiento> {
  const filas = await db.insert(serviciosVencimiento).values(datos).returning();
  return filas[0]!;
}

export async function obtenerPorId(id: string) {
  return db.query.serviciosVencimiento.findFirst({ where: eq(serviciosVencimiento.id, id), with: conDetalle });
}

/** Los servicios que siguen activos (no dados de baja), con su propiedad y lo cargado por mes. */
export async function listarActivos() {
  return db.query.serviciosVencimiento.findMany({
    where: eq(serviciosVencimiento.activo, true),
    with: conDetalle,
    orderBy: [asc(serviciosVencimiento.diaVencimiento), asc(serviciosVencimiento.nombre)],
  });
}

/** Todos, incluso los dados de baja (para el historial de la planilla). */
export async function listarTodos() {
  return db.query.serviciosVencimiento.findMany({ with: conDetalle, orderBy: asc(serviciosVencimiento.nombre) });
}

export async function actualizar(
  id: string,
  datos: { diaVencimiento?: number; monto?: string | null; activo?: boolean },
): Promise<ServicioVencimiento | undefined> {
  const filas = await db
    .update(serviciosVencimiento)
    .set({ ...datos, updatedAt: new Date() })
    .where(eq(serviciosVencimiento.id, id))
    .returning();
  return filas[0];
}

/** Guarda lo de un mes (otra fecha de vencimiento y/o el pago): crea la fila o actualiza la que hay. */
export async function guardarMes(
  servicioId: string,
  periodo: string,
  datos: { fechaVencimiento?: string; fechaPago?: string; monto?: string | null; gastoId?: string | null },
): Promise<MesServicio> {
  const filas = await db
    .insert(serviciosVencimientoMes)
    .values({ servicioId, periodo, ...datos })
    .onConflictDoUpdate({
      target: [serviciosVencimientoMes.servicioId, serviciosVencimientoMes.periodo],
      set: { ...datos, updatedAt: new Date() },
    })
    .returning();
  return filas[0]!;
}
