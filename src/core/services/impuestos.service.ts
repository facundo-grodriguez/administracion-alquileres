import type { ImpuestoServicio } from "../repositories/impuestosServicios.repository.js";
import * as impuestosRepo from "../repositories/impuestosServicios.repository.js";
import * as movimientosRepo from "../repositories/movimientosFinancieros.repository.js";

/**
 * Marca un impuesto/servicio como pagado y, si tiene monto estimado, refleja el gasto en
 * movimientos_financieros (vía referenciaTipo="impuesto_servicio") — best-effort: si ese
 * segundo paso falla, no aborta la actualización principal, solo lo loguea. Idempotente:
 * volver a llamarla con otro monto corrige el movimiento existente en vez de duplicarlo.
 */
export async function marcarPagado(input: {
  impuestoServicioId: string;
  fechaPago: string;
  monto?: string;
}): Promise<ImpuestoServicio | undefined> {
  const item = await impuestosRepo.marcarPagado(input.impuestoServicioId, input.fechaPago, input.monto);
  if (!item) return undefined;

  if (item.montoEstimado) {
    try {
      await movimientosRepo.upsertPorReferencia({
        propiedadId: item.propiedadId,
        tipo: "gasto",
        categoria: item.tipo,
        monto: item.montoEstimado,
        fecha: item.fechaPago!,
        referenciaTipo: "impuesto_servicio",
        referenciaId: item.id,
        descripcion: `${item.tipo}${item.numeroCuenta ? ` (cuenta ${item.numeroCuenta})` : ""}`,
      });
    } catch (error) {
      console.error("No se pudo registrar el movimiento financiero del impuesto/servicio:", error);
    }
  }

  return item;
}
