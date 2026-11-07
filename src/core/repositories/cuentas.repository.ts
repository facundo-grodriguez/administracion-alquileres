import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { cuentasMes, cuentasRubros } from "../db/schema.js";

export type RubroCuenta = typeof cuentasRubros.$inferSelect;

// Con lo de cada mes y, si está vinculado, el vencimiento con sus meses (y el gasto de cada uno).
const conDetalle = {
  meses: true,
  servicio: { with: { propiedad: true, meses: { with: { gasto: true } } } },
} as const;

export async function listarActivos() {
  return db.query.cuentasRubros.findMany({
    where: eq(cuentasRubros.activo, true),
    with: conDetalle,
    orderBy: [asc(cuentasRubros.orden), asc(cuentasRubros.createdAt)],
  });
}

export async function crear(datos: {
  nombre: string;
  tipo: "gasto" | "ingreso";
  previsto?: string | null;
  servicioId?: string | null;
  orden: number;
}): Promise<RubroCuenta> {
  const filas = await db.insert(cuentasRubros).values(datos).returning();
  return filas[0]!;
}

export async function actualizar(
  id: string,
  datos: {
    nombre?: string;
    tipo?: "gasto" | "ingreso";
    previsto?: string | null;
    servicioId?: string | null;
    activo?: boolean;
  },
): Promise<RubroCuenta | undefined> {
  const filas = await db
    .update(cuentasRubros)
    .set({ ...datos, updatedAt: new Date() })
    .where(eq(cuentasRubros.id, id))
    .returning();
  return filas[0];
}

export async function obtenerMes(rubroId: string, periodo: string) {
  return db.query.cuentasMes.findFirst({
    where: and(eq(cuentasMes.rubroId, rubroId), eq(cuentasMes.periodo, periodo)),
  });
}

/** Guarda lo de un mes (previsto de ese mes y/o lo real): crea la fila o actualiza la que hay. */
export async function guardarMes(
  rubroId: string,
  periodo: string,
  datos: { previsto?: string | null; real?: string | null },
) {
  const filas = await db
    .insert(cuentasMes)
    .values({ rubroId, periodo, ...datos })
    .onConflictDoUpdate({ target: [cuentasMes.rubroId, cuentasMes.periodo], set: { ...datos, updatedAt: new Date() } })
    .returning();
  return filas[0]!;
}
