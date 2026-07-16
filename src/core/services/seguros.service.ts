import * as movimientosRepo from "../repositories/movimientosFinancieros.repository.js";
import type { Seguro } from "../repositories/seguros.repository.js";
import * as segurosRepo from "../repositories/seguros.repository.js";

/**
 * Marca un seguro como pagado y, si tiene costo, refleja el gasto en movimientos_financieros
 * (vía referenciaTipo="seguro") — best-effort: si ese segundo paso falla, no aborta la
 * actualización principal, solo lo loguea. Idempotente: volver a llamarla con otro monto
 * corrige el movimiento existente en vez de duplicarlo.
 */
export async function marcarPagado(input: {
  seguroId: string;
  fechaPago: string;
  monto?: string;
}): Promise<Seguro | undefined> {
  const seguro = await segurosRepo.marcarPagado(input.seguroId, input.fechaPago, input.monto);
  if (!seguro) return undefined;

  if (seguro.costo) {
    try {
      await movimientosRepo.upsertPorReferencia({
        propiedadId: seguro.propiedadId,
        tipo: "gasto",
        categoria: "seguro",
        monto: seguro.costo,
        fecha: seguro.fechaPago!,
        referenciaTipo: "seguro",
        referenciaId: seguro.id,
        descripcion: `Seguro ${seguro.compania}`,
      });
    } catch (error) {
      console.error("No se pudo registrar el movimiento financiero del seguro:", error);
    }
  }

  return seguro;
}
