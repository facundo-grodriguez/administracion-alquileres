import type { GastoPropiedad } from "../repositories/gastosPropiedad.repository.js";
import * as gastosRepo from "../repositories/gastosPropiedad.repository.js";
import * as movimientosRepo from "../repositories/movimientosFinancieros.repository.js";

/**
 * Marca un gasto de propiedad como pagado y, si tiene monto, refleja el gasto en
 * movimientos_financieros (vía referenciaTipo="gasto_propiedad") — best-effort: si ese
 * segundo paso falla, no aborta la actualización principal, solo lo loguea. Idempotente:
 * volver a llamarla con otro monto corrige el movimiento existente en vez de duplicarlo.
 */
export async function marcarPagado(input: {
  gastoId: string;
  fechaPago: string;
  monto?: string;
}): Promise<GastoPropiedad | undefined> {
  const gasto = await gastosRepo.marcarPagado(input.gastoId, input.fechaPago, input.monto);
  if (!gasto) return undefined;

  if (gasto.monto) {
    try {
      await movimientosRepo.upsertPorReferencia({
        propiedadId: gasto.propiedadId,
        tipo: "gasto",
        categoria: gasto.tipo,
        monto: gasto.monto,
        fecha: gasto.fechaPago!,
        referenciaTipo: "gasto_propiedad",
        referenciaId: gasto.id,
        descripcion: gasto.tipo,
      });
    } catch (error) {
      console.error("No se pudo registrar el movimiento financiero del gasto:", error);
    }
  }

  return gasto;
}
