// "💡 Gastos sin pagar" (v9.12.0): en un solo lugar los gastos de propiedades cargados y los
// vencimientos de servicios del mes (personales y de propiedades) que todavía no se pagaron.
// Un vencimiento vinculado a un gasto no se repite: aparece solo el gasto.
import * as gastosRepo from "../repositories/gastosPropiedad.repository.js";
import { formatoFechaAR, hoyISO } from "../util/fecha.js";
import { formatoARS } from "../util/formato.js";
import { nombreRubro } from "../util/rubroGasto.js";
import { cuandoVence, iconoServicio } from "../util/vencimientoServicio.js";
import * as serviciosService from "./serviciosVencimiento.service.js";

type Gasto = Awaited<ReturnType<typeof gastosRepo.listarPendientes>>[number];
type Servicio = serviciosService.VencimientoServicio;

export type SinPagar = { gastos: Gasto[]; servicios: Servicio[] };

export async function sinPagar(hoy = hoyISO()): Promise<SinPagar> {
  const gastos = await gastosRepo.listarPendientes();
  const servicios = (await serviciosService.paraPagar(hoy)).filter((v) => !v.gastoId);
  return { gastos, servicios };
}

type Item = { propiedad: string | null; fecha: string; monto: number; linea: string };

function lineaGasto(g: Gasto, hoy: string): string {
  const rubro = nombreRubro(g.tipo);
  const vencido = g.fechaVencimiento < hoy ? "⚠️ " : "";
  return [
    `• ${iconoServicio(rubro)} ${rubro} — ${formatoFechaAR(g.fechaVencimiento)} (${vencido}${cuandoVence(hoy, g.fechaVencimiento)})`,
    g.monto ? ` — ${formatoARS(g.monto)}` : "",
    g.responsable === "inquilino" ? " — lo paga el inquilino" : "",
  ].join("");
}

/** Mensaje de "💡 Gastos sin pagar": 👤 Personal y cada 🏠 propiedad por separado, con subtotales. */
export function textoSinPagar({ gastos, servicios }: SinPagar, hoy = hoyISO()): string {
  const items: Item[] = [
    ...gastos.map((g) => ({
      propiedad: g.propiedad.direccion,
      fecha: g.fechaVencimiento,
      monto: Number(g.monto ?? 0),
      linea: lineaGasto(g, hoy),
    })),
    ...servicios.map((v) => ({
      propiedad: v.propiedad,
      fecha: v.fechaVencimiento,
      monto: Number(v.monto ?? 0),
      linea: `• ${serviciosService.lineaServicio(v, hoy, { sinDuenio: true })}`,
    })),
  ];
  if (items.length === 0) return "💡 Gastos sin pagar\n\nNo hay nada sin pagar. ✅";

  const grupos = new Map<string, Item[]>();
  for (const it of items) grupos.set(it.propiedad ?? "", [...(grupos.get(it.propiedad ?? "") ?? []), it]);
  const claves = [...grupos.keys()].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
  const suma = (lista: Item[]) => lista.reduce((acc, it) => acc + it.monto, 0);
  const monto = (n: number) => (n > 0 ? ` — ${formatoARS(String(n))}` : "");

  const lineas = [`💡 Gastos sin pagar (${items.length})${monto(suma(items))}`];
  for (const clave of claves) {
    const grupo = grupos.get(clave)!.sort((a, b) => a.fecha.localeCompare(b.fecha));
    lineas.push(
      "",
      `${clave === "" ? "👤 Personal" : `🏠 ${clave}`}${monto(suma(grupo))}`,
      ...grupo.map((it) => it.linea),
    );
  }
  if (servicios.length > 0) lineas.push("", "Los montos de los vencimientos son aproximados.");
  return lineas.join("\n");
}
