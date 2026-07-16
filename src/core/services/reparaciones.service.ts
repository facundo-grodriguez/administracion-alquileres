import * as documentosRepo from "../repositories/documentos.repository.js";
import * as movimientosRepo from "../repositories/movimientosFinancieros.repository.js";
import type { NuevaReparacion, Reparacion } from "../repositories/reparaciones.repository.js";
import * as reparacionesRepo from "../repositories/reparaciones.repository.js";

/**
 * Crea la reparación y, si tiene costo cargado, refleja el gasto en movimientos_financieros
 * (vía referenciaTipo="reparacion") para no tener que cargarlo dos veces. Si ese segundo paso
 * falla, no aborta el alta de la reparación (que es el dato que importa) — solo lo loguea.
 */
export async function crearReparacion(datos: NuevaReparacion): Promise<Reparacion> {
  const reparacion = await reparacionesRepo.crearReparacion(datos);

  if (reparacion.costo) {
    try {
      await movimientosRepo.upsertPorReferencia({
        propiedadId: reparacion.propiedadId,
        tipo: "gasto",
        categoria: "reparacion",
        monto: reparacion.costo,
        fecha: reparacion.fecha,
        referenciaTipo: "reparacion",
        referenciaId: reparacion.id,
        descripcion: reparacion.descripcion,
      });
    } catch (error) {
      console.error("No se pudo registrar el movimiento financiero de la reparación:", error);
    }
  }

  return reparacion;
}

export async function adjuntarComprobante(input: {
  reparacionId: string;
  link: string;
  nombreArchivo?: string;
  tipoDocumento?: "comprobante" | "foto" | "factura" | "otro";
  notas?: string;
}) {
  const documento = await documentosRepo.crearDocumento({
    entidadTipo: "reparacion",
    entidadId: input.reparacionId,
    tipoDocumento: input.tipoDocumento ?? "comprobante",
    storagePath: input.link,
    nombreArchivo: input.nombreArchivo ?? "comprobante",
    notas: input.notas,
  });
  const reparacion = await reparacionesRepo.adjuntarComprobante(input.reparacionId, documento.id);
  return { documento, reparacion };
}
