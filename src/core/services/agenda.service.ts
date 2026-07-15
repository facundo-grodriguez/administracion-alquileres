import * as reparacionesRepo from "../repositories/reparaciones.repository.js";
import { hoyISO, sumarDiasISO } from "../util/fecha.js";
import { formatoARS } from "../util/formato.js";
import * as pagosService from "./pagos.service.js";
import * as vencimientosService from "./vencimientos.service.js";

export type ResumenAgenda = {
  cobrosPendientes: Awaited<ReturnType<typeof pagosService.resumenCobrosDelMes>>;
  vencimientos: Awaited<ReturnType<typeof vencimientosService.listarVencimientos>>;
  reparacionesAbiertas: Awaited<ReturnType<typeof reparacionesRepo.listarAbiertas>>;
};

/**
 * Resumen completo de la agenda, calculado al vuelo desde las fechas guardadas.
 * `horizonteDias` define hasta cuándo mirar los vencimientos próximos (default 30 días).
 */
export async function obtenerResumenAgenda(horizonteDias = 30): Promise<ResumenAgenda> {
  const hasta = sumarDiasISO(hoyISO(), horizonteDias);

  const [cobros, vencimientos, reparacionesAbiertas] = await Promise.all([
    pagosService.resumenCobrosDelMes(),
    vencimientosService.listarVencimientos(undefined, hasta),
    reparacionesRepo.listarAbiertas(),
  ]);

  const cobrosPendientes = cobros.filter((c) => c.estado !== "pagado");

  return { cobrosPendientes, vencimientos, reparacionesAbiertas };
}

function diasTexto(diasRestantes: number): string {
  if (diasRestantes < 0) return `atrasado ${Math.abs(diasRestantes)} día${Math.abs(diasRestantes) === 1 ? "" : "s"}`;
  if (diasRestantes === 0) return "vence hoy";
  if (diasRestantes === 1) return "vence mañana";
  return `en ${diasRestantes} días`;
}

export function formatearResumenAgenda(resumen: ResumenAgenda): string {
  const { cobrosPendientes, vencimientos, reparacionesAbiertas } = resumen;

  if (cobrosPendientes.length === 0 && vencimientos.length === 0 && reparacionesAbiertas.length === 0) {
    return `📅 Agenda (${hoyISO()})\n\nNo hay nada pendiente. Todo al día. ✅`;
  }

  const bloques: string[] = [`📅 Agenda (${hoyISO()})`];

  if (cobrosPendientes.length > 0) {
    const lineas = cobrosPendientes.map((c) => {
      const marca = c.estado === "atrasado" ? " ⚠️ ATRASADO" : "";
      return `  • ${c.inquilino} — ${c.propiedad} — ${formatoARS(c.monto)} (vence ${c.fechaVencimiento})${marca}`;
    });
    bloques.push(`💰 Alquileres a cobrar (${cobrosPendientes.length}):\n${lineas.join("\n")}`);
  }

  if (vencimientos.length > 0) {
    const lineas = vencimientos.map(
      (v) => `  • ${v.descripcion} — ${v.propiedad} — ${v.fechaVencimiento} (${diasTexto(v.diasRestantes)})`,
    );
    bloques.push(`⏰ Vencimientos próximos (${vencimientos.length}):\n${lineas.join("\n")}`);
  }

  if (reparacionesAbiertas.length > 0) {
    const lineas = reparacionesAbiertas.map((r) => `  • ${r.descripcion} — ${r.propiedad.direccion} (${r.estado})`);
    bloques.push(`🔧 Reparaciones abiertas (${reparacionesAbiertas.length}):\n${lineas.join("\n")}`);
  }

  return bloques.join("\n\n");
}
