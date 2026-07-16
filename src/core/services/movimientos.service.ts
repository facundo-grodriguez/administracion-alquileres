import * as movimientosRepo from "../repositories/movimientosFinancieros.repository.js";
import { hoyISO } from "../util/fecha.js";
import { formatoARS } from "../util/formato.js";

export type BalanceFinanciero = {
  desde: string;
  hasta: string;
  ingresos: number;
  gastos: number;
  neto: number;
  movimientos: Awaited<ReturnType<typeof movimientosRepo.listarPorRango>>;
};

export async function calcularBalance(filtros: {
  propiedadId?: string;
  desde?: string;
  hasta?: string;
}): Promise<BalanceFinanciero> {
  const hoy = hoyISO();
  const desde = filtros.desde ?? `${hoy.slice(0, 7)}-01`;
  const hasta = filtros.hasta ?? hoy;

  const movimientos = await movimientosRepo.listarPorRango({ propiedadId: filtros.propiedadId, desde, hasta });
  const ingresos = movimientos.filter((m) => m.tipo === "ingreso").reduce((acc, m) => acc + Number(m.monto), 0);
  const gastos = movimientos.filter((m) => m.tipo === "gasto").reduce((acc, m) => acc + Number(m.monto), 0);

  return { desde, hasta, ingresos, gastos, neto: ingresos - gastos, movimientos };
}

export function formatearBalance(balance: BalanceFinanciero, propiedadDireccion?: string): string {
  const encabezado = propiedadDireccion
    ? `💵 Balance de ${propiedadDireccion} (${balance.desde} a ${balance.hasta})`
    : `💵 Balance general — todas las propiedades (${balance.desde} a ${balance.hasta})`;

  if (balance.movimientos.length === 0) return `${encabezado}\n\nNo hay movimientos registrados en ese rango.`;

  const detalle = balance.movimientos
    .map(
      (m) =>
        `  • [${m.tipo}] ${m.categoria} — ${formatoARS(m.monto)} (${m.fecha})${m.descripcion ? ` — ${m.descripcion}` : ""}`,
    )
    .join("\n");

  return [
    encabezado,
    `Ingresos: ${formatoARS(balance.ingresos)}`,
    `Gastos: ${formatoARS(balance.gastos)}`,
    `Resultado neto: ${formatoARS(balance.neto)}`,
    `Detalle (${balance.movimientos.length}):\n${detalle}`,
  ].join("\n\n");
}
