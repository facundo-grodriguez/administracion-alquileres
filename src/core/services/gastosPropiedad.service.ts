import type { GastoPropiedad } from "../repositories/gastosPropiedad.repository.js";
import * as gastosRepo from "../repositories/gastosPropiedad.repository.js";
import * as movimientosRepo from "../repositories/movimientosFinancieros.repository.js";

/**
 * Refleja un gasto pagado (y con monto) en movimientos_financieros, vía referenciaTipo="gasto_propiedad"
 * — es lo que lo hace aparecer en el balance. Best-effort: si falla, solo se loguea. Idempotente:
 * si el movimiento ya existía, lo corrige en vez de duplicarlo.
 */
async function sincronizarMovimiento(gasto: GastoPropiedad): Promise<void> {
  if (!gasto.monto || !gasto.fechaPago) return;
  try {
    await movimientosRepo.upsertPorReferencia({
      propiedadId: gasto.propiedadId,
      tipo: "gasto",
      categoria: gasto.tipo,
      monto: gasto.monto,
      fecha: gasto.fechaPago,
      referenciaTipo: "gasto_propiedad",
      referenciaId: gasto.id,
      descripcion: gasto.tipo,
    });
  } catch (error) {
    console.error("No se pudo registrar el movimiento financiero del gasto:", error);
  }
}

/** Marca un gasto de propiedad como pagado y lo refleja en el balance (si tiene monto). */
export async function marcarPagado(input: {
  gastoId: string;
  fechaPago: string;
  monto?: string;
}): Promise<GastoPropiedad | undefined> {
  const gasto = await gastosRepo.marcarPagado(input.gastoId, input.fechaPago, input.monto);
  if (gasto) await sincronizarMovimiento(gasto);
  return gasto;
}

/**
 * Corrige un gasto ya cargado (monto, vencimiento y/o fecha de pago). Si queda pagado y con monto,
 * el balance se actualiza con los valores nuevos.
 */
export async function corregir(input: {
  gastoId: string;
  monto?: string;
  fechaVencimiento?: string;
  fechaPago?: string;
}): Promise<
  { antes: NonNullable<Awaited<ReturnType<typeof gastosRepo.obtenerPorId>>>; despues: GastoPropiedad } | undefined
> {
  const antes = await gastosRepo.obtenerPorId(input.gastoId);
  if (!antes) return undefined;
  const despues = await gastosRepo.actualizarGasto(input.gastoId, {
    monto: input.monto,
    fechaVencimiento: input.fechaVencimiento,
    fechaPago: input.fechaPago,
  });
  if (!despues) return undefined;
  await sincronizarMovimiento(despues);
  return { antes, despues };
}
