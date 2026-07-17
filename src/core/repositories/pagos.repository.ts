import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { pagos } from "../db/schema.js";

export type Pago = typeof pagos.$inferSelect;
export type NuevoPago = typeof pagos.$inferInsert;

const conContrato = { contrato: { with: { inquilino: true, propiedad: true } } } as const;

export async function crearPago(datos: NuevoPago): Promise<Pago> {
  const filas = await db.insert(pagos).values(datos).returning();
  return filas[0]!;
}

export async function registrarPagoRecibido(
  pagoId: string,
  fechaPago: string,
  monto: string,
  medioPago?: string,
  observaciones?: string,
): Promise<Pago | undefined> {
  const [pago] = await db
    .update(pagos)
    .set({ estado: "pagado", fechaPago, monto, medioPago, observaciones, updatedAt: new Date() })
    .where(eq(pagos.id, pagoId))
    .returning();
  return pago;
}

export async function buscarPagoPorContratoYPeriodo(contratoId: string, periodo: string) {
  return db.query.pagos.findFirst({
    where: and(eq(pagos.contratoId, contratoId), eq(pagos.periodo, periodo)),
    with: conContrato,
  });
}
