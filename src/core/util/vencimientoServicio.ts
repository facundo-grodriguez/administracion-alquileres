// Vencimientos de servicios (luz, gas, celular, prepaga...): reglas puras de fechas y avisos,
// sin base de datos, para poder testearlas solas.
import { diasEntreISO } from "./fecha.js";

/** Días de anticipación del primer aviso (además del aviso del mismo día). */
export const DIAS_AVISO_PREVIO = 3;
/** Si el bot no pudo avisar el día del vencimiento (estaba caído), lo avisa igual hasta N días después. */
export const DIAS_GRACIA_AVISO = 2;

export const SERVICIOS = [
  { valor: "Luz", etiqueta: "⚡ Luz" },
  { valor: "Gas", etiqueta: "🔥 Gas" },
  { valor: "Agua", etiqueta: "💧 Agua" },
  { valor: "Internet", etiqueta: "🌐 Internet" },
  { valor: "Celular", etiqueta: "📱 Celular" },
  { valor: "Expensas", etiqueta: "🏢 Expensas" },
  { valor: "ABL", etiqueta: "🏛️ ABL" },
  { valor: "ARBA", etiqueta: "🏛️ ARBA" },
  { valor: "Seguro", etiqueta: "🛡️ Seguro" },
  { valor: "Prepaga", etiqueta: "🩺 Prepaga" },
  { valor: "Tarjeta", etiqueta: "💳 Tarjeta" },
  { valor: "otro", etiqueta: "📌 Otro" },
];

/** Rubro del gasto de propiedad que corresponde a un servicio ("Luz" → luz, "Seguro" → seguro_hogar). */
const TIPO_GASTO: Record<string, "luz" | "gas" | "agua" | "internet" | "expensas" | "ABL" | "ARBA" | "seguro_hogar"> = {
  luz: "luz",
  gas: "gas",
  agua: "agua",
  internet: "internet",
  expensas: "expensas",
  abl: "ABL",
  arba: "ARBA",
  seguro: "seguro_hogar",
};

export function tipoGastoDeServicio(nombre: string) {
  return TIPO_GASTO[nombre.trim().toLowerCase()] ?? ("otro" as const);
}

/** Emoji del servicio según su nombre ("Luz" → ⚡). Los que no están en la lista llevan 📌. */
export function iconoServicio(nombre: string): string {
  const n = nombre.trim().toLowerCase();
  const conocido = SERVICIOS.find((s) => s.valor !== "otro" && s.valor.toLowerCase() === n);
  return conocido ? conocido.etiqueta.split(" ")[0]! : "📌";
}

/** "⚡ Luz (Personal)" o "⚡ Luz (Cerrito 4070)". */
export function nombreServicio(nombre: string, propiedad?: string | null): string {
  return `${iconoServicio(nombre)} ${nombre} (${propiedad ?? "Personal"})`;
}

/** "2026-11" → "2026-12". */
export function periodoSiguiente(periodo: string): string {
  const [anio, mes] = periodo.split("-").map(Number) as [number, number];
  return mes === 12 ? `${anio + 1}-01` : `${anio}-${String(mes + 1).padStart(2, "0")}`;
}

/**
 * Fecha de vencimiento de un mes a partir del día fijo. Si el mes no tiene ese día
 * (ej. día 31 en noviembre), vence el último día del mes.
 */
export function fechaDelPeriodo(dia: number, periodo: string): string {
  const [anio, mes] = periodo.split("-").map(Number) as [number, number];
  const ultimoDia = new Date(anio, mes, 0).getDate();
  return `${periodo}-${String(Math.min(dia, ultimoDia)).padStart(2, "0")}`;
}

export type EstadoMes = { fechaVencimiento?: string | null; fechaPago?: string | null };

/** Vencimiento de un mes: la fecha cambiada a mano para ese mes, o la del día fijo. */
export function vencimientoDelMes(dia: number, periodo: string, mes?: EstadoMes): string {
  return mes?.fechaVencimiento ?? fechaDelPeriodo(dia, periodo);
}

/**
 * El vencimiento pendiente de un servicio: el de este mes si todavía no se pagó (aunque ya haya
 * vencido), o si no el del mes que viene. Es el que se modifica con "cambiar la fecha de este mes".
 */
export function periodoPendiente(hoy: string, pagado: (periodo: string) => boolean): string {
  const actual = hoy.slice(0, 7);
  return pagado(actual) ? periodoSiguiente(actual) : actual;
}

export type TipoAviso = "previo" | "dia";

/**
 * Qué aviso toca mandar hoy para un vencimiento sin pagar, o ninguno:
 * - "previo": faltan de 1 a 3 días y todavía no se mandó.
 * - "dia": vence hoy (o venció hace 1-2 días y no se llegó a avisar) y todavía no se mandó.
 */
export function avisoQueCorresponde(
  hoy: string,
  fechaVencimiento: string,
  enviados: { previo: boolean; dia: boolean },
): TipoAviso | undefined {
  const dias = diasEntreISO(hoy, fechaVencimiento);
  if (dias <= 0 && dias >= -DIAS_GRACIA_AVISO) return enviados.dia ? undefined : "dia";
  if (dias >= 1 && dias <= DIAS_AVISO_PREVIO) return enviados.previo || enviados.dia ? undefined : "previo";
  return undefined;
}

/** Texto corto de cuánto falta: "vence hoy", "vence mañana", "vence en 3 días", "venció hace 2 días". */
export function cuandoVence(hoy: string, fechaVencimiento: string): string {
  const dias = diasEntreISO(hoy, fechaVencimiento);
  if (dias === 0) return "vence hoy";
  if (dias === 1) return "vence mañana";
  if (dias > 1) return `vence en ${dias} días`;
  if (dias === -1) return "venció ayer";
  return `venció hace ${-dias} días`;
}
