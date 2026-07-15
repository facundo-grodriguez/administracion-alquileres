import * as pagosService from "./pagos.service.js";
import * as vencimientosService from "./vencimientos.service.js";

export type ResumenAgenda = {
  contratosPorVencer: Awaited<ReturnType<typeof vencimientosService.listarVencimientos>>;
  alquileresAtrasados: Awaited<ReturnType<typeof pagosService.listarAtrasados>>;
};

/** Calculado al vuelo desde las fechas guardadas — no depende de ningún proceso en segundo plano. */
export async function obtenerResumenAgenda(): Promise<ResumenAgenda> {
  const [contratosPorVencer, alquileresAtrasados] = await Promise.all([
    vencimientosService.listarVencimientos(),
    pagosService.listarAtrasados(),
  ]);
  return { contratosPorVencer, alquileresAtrasados };
}

export function formatearResumenAgenda(resumen: ResumenAgenda): string {
  if (resumen.contratosPorVencer.length === 0 && resumen.alquileresAtrasados.length === 0) {
    return "No hay vencimientos próximos ni alquileres atrasados. Todo al día.";
  }

  const lineas: string[] = [];

  if (resumen.alquileresAtrasados.length > 0) {
    lineas.push(`Alquileres atrasados (${resumen.alquileresAtrasados.length}):`);
    for (const a of resumen.alquileresAtrasados) {
      lineas.push(`  - ${a.inquilino} — ${a.propiedad} (vencía ${a.fechaVencimiento})`);
    }
  }

  if (resumen.contratosPorVencer.length > 0) {
    lineas.push(`Contratos que vencen en los próximos 30 días (${resumen.contratosPorVencer.length}):`);
    for (const c of resumen.contratosPorVencer) {
      lineas.push(`  - ${c.inquilino} — ${c.propiedad} (vence ${c.fechaFin})`);
    }
  }

  return lineas.join("\n");
}
