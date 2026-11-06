// Vencimientos de servicios (v9.8.0): qué vence cada mes, qué falta pagar y qué aviso toca hoy.
// Son recordatorios del administrador. Los personales no tocan el balance; los de una propiedad, al
// pagarlos, se cargan también como gasto de esa propiedad (v9.9.0).
import * as contratosRepo from "../repositories/contratos.repository.js";
import * as gastosRepo from "../repositories/gastosPropiedad.repository.js";
import * as recordatoriosRepo from "../repositories/recordatorios.repository.js";
import * as serviciosRepo from "../repositories/serviciosVencimiento.repository.js";
import { diasEntreISO, formatoFechaAR, formatoPeriodoAR, hoyISO, periodosEntre, sumarDiasISO } from "../util/fecha.js";
import { formatoARS } from "../util/formato.js";
import type { Responsable } from "../util/responsableGasto.js";
import {
  avisoQueCorresponde,
  cuandoVence,
  existiaEnPeriodo,
  iconoServicio,
  nombreServicio,
  periodoPendiente,
  periodoSiguiente,
  type TipoAviso,
  tipoGastoDeServicio,
  vencimientoDelMes,
} from "../util/vencimientoServicio.js";
import * as gastosService from "./gastosPropiedad.service.js";

type ServicioConDetalle = NonNullable<Awaited<ReturnType<typeof serviciosRepo.obtenerPorId>>>;

export type VencimientoServicio = {
  servicioId: string;
  nombre: string;
  /** Dirección de la propiedad, o null si es personal. */
  propiedad: string | null;
  propiedadId: string | null;
  diaVencimiento: number;
  periodo: string;
  fechaVencimiento: string;
  fechaPago: string | null;
  monto: string | null;
  /** Gasto de la propiedad cargado al pagarlo (solo servicios de una propiedad). */
  gastoId: string | null;
  diasRestantes: number;
};

function armar(servicio: ServicioConDetalle, periodo: string, hoy: string): VencimientoServicio {
  const mes = servicio.meses.find((m) => m.periodo === periodo);
  const fechaVencimiento = vencimientoDelMes(servicio.diaVencimiento, periodo, mes);
  return {
    servicioId: servicio.id,
    nombre: servicio.nombre,
    propiedad: servicio.propiedad?.direccion ?? null,
    propiedadId: servicio.propiedadId,
    diaVencimiento: servicio.diaVencimiento,
    periodo,
    fechaVencimiento,
    fechaPago: mes?.fechaPago ?? null,
    monto: mes?.monto ?? servicio.monto,
    gastoId: mes?.gastoId ?? null,
    diasRestantes: diasEntreISO(hoy, fechaVencimiento),
  };
}

const porFecha = (a: VencimientoServicio, b: VencimientoServicio) =>
  a.fechaVencimiento.localeCompare(b.fechaVencimiento) || a.nombre.localeCompare(b.nombre);

/** Todos los servicios activos en un mes (pagados o no), ordenados por fecha. Los cargados después de ese mes no aparecen. */
export async function delMes(periodo?: string, hoy = hoyISO()): Promise<VencimientoServicio[]> {
  const p = periodo ?? hoy.slice(0, 7);
  return (await serviciosRepo.listarActivos())
    .filter((s) =>
      existiaEnPeriodo(
        s.createdAt,
        p,
        s.meses.some((m) => m.periodo === p),
      ),
    )
    .map((s) => armar(s, p, hoy))
    .sort(porFecha);
}

/**
 * Sin pagar que vencen entre `desde` y `hasta`, más los de este mes que ya vencieron y siguen sin
 * pagar (atrasados). Es lo que entra en la agenda y en "Vencimientos (30 días)".
 */
export async function sinPagarHasta(hasta: string, hoy = hoyISO()): Promise<VencimientoServicio[]> {
  const servicios = await serviciosRepo.listarActivos();
  const items: VencimientoServicio[] = [];
  for (const periodo of periodosEntre(hoy.slice(0, 7), hasta.slice(0, 7))) {
    for (const s of servicios) {
      const item = armar(s, periodo, hoy);
      if (item.fechaPago || item.fechaVencimiento > hasta) continue;
      if (item.fechaVencimiento < hoy && periodo !== hoy.slice(0, 7)) continue;
      items.push(item);
    }
  }
  return items.sort(porFecha);
}

/** Lo que se puede marcar como pagado ahora: lo de este mes sin pagar y lo que vence en los próximos 10 días. */
export async function paraPagar(hoy = hoyISO()): Promise<VencimientoServicio[]> {
  return sinPagarHasta(sumarDiasISO(hoy, 10), hoy);
}

/** El vencimiento pendiente de un servicio (el de este mes si no se pagó, si no el del que viene). */
export function pendienteDe(servicio: ServicioConDetalle, hoy = hoyISO()): VencimientoServicio {
  const periodo = periodoPendiente(hoy, (p) => Boolean(servicio.meses.find((m) => m.periodo === p)?.fechaPago));
  return armar(servicio, periodo, hoy);
}

export async function obtener(servicioId: string, periodo?: string, hoy = hoyISO()) {
  const servicio = await serviciosRepo.obtenerPorId(servicioId);
  if (!servicio) return undefined;
  return periodo ? armar(servicio, periodo, hoy) : pendienteDe(servicio, hoy);
}

/**
 * Historial mes a mes de los servicios personales (para la planilla): desde que se cargó cada uno
 * hasta el mes que viene. Los dados de baja solo aparecen en los meses que tienen algo cargado.
 */
export async function historialPersonales(hoy = hoyISO()): Promise<VencimientoServicio[]> {
  const hasta = periodoSiguiente(hoy.slice(0, 7));
  const items: VencimientoServicio[] = [];
  for (const s of await serviciosRepo.listarTodos()) {
    if (s.propiedadId) continue;
    const creado = `${s.createdAt.getFullYear()}-${String(s.createdAt.getMonth() + 1).padStart(2, "0")}`;
    const desde = [creado, ...s.meses.map((m) => m.periodo)].sort()[0]!;
    for (const periodo of periodosEntre(desde, hasta)) {
      if (!s.activo && !s.meses.some((m) => m.periodo === periodo)) continue;
      items.push(armar(s, periodo, hoy));
    }
  }
  return items;
}

const TIPO_AVISO: Record<TipoAviso, string> = { previo: "servicio_aviso_previo", dia: "servicio_aviso_dia" };

/** Los avisos que hay que mandar hoy (3 días antes y el día), sin repetir los ya mandados. */
export async function avisosDeHoy(
  hoy = hoyISO(),
  opciones?: { ignorarEnviados?: boolean },
): Promise<{ item: VencimientoServicio; tipo: TipoAviso }[]> {
  const servicios = await serviciosRepo.listarActivos();
  const avisos: { item: VencimientoServicio; tipo: TipoAviso }[] = [];
  const actual = hoy.slice(0, 7);
  for (const s of servicios) {
    for (const periodo of [actual, periodoSiguiente(actual)]) {
      const item = armar(s, periodo, hoy);
      if (item.fechaPago) continue;
      const [previo, dia] = opciones?.ignorarEnviados
        ? [false, false]
        : await Promise.all([
            recordatoriosRepo.yaAvisado(TIPO_AVISO.previo, s.id, item.fechaVencimiento),
            recordatoriosRepo.yaAvisado(TIPO_AVISO.dia, s.id, item.fechaVencimiento),
          ]);
      const tipo = avisoQueCorresponde(hoy, item.fechaVencimiento, { previo, dia });
      if (tipo) avisos.push({ item, tipo });
    }
  }
  return avisos.sort((a, b) => porFecha(a.item, b.item));
}

export async function registrarAvisoEnviado(item: VencimientoServicio, tipo: TipoAviso, texto: string) {
  await recordatoriosRepo.registrarAviso(TIPO_AVISO[tipo], "servicio", item.servicioId, item.fechaVencimiento, texto);
}

export async function crear(datos: {
  nombre: string;
  propiedadId?: string | null;
  diaVencimiento: number;
  monto?: string | null;
}) {
  const creado = await serviciosRepo.crear(datos);
  return (await obtener(creado.id))!;
}

/** true si la propiedad tiene un contrato vigente (hay inquilino que podría haberlo pagado). */
export async function propiedadAlquilada(propiedadId: string | null): Promise<boolean> {
  if (!propiedadId) return false;
  return Boolean(await contratosRepo.buscarContratoVigentePorPropiedad(propiedadId));
}

/**
 * Quién pagó un servicio de propiedad si no se dijo: si la propiedad no está alquilada, el propietario
 * (resta del balance); si está alquilada y no se eligió, también el propietario (el que lo paga desde
 * el bot es el administrador). El flujo pregunta cuando hay inquilino.
 */
export function responsableDelPago(elegido?: Responsable): Responsable {
  return elegido ?? "propietario";
}

/**
 * Carga (o corrige, si ya estaba) el gasto de la propiedad que corresponde a un servicio pagado.
 * Devuelve el gasto, o undefined si el servicio es personal.
 */
async function sincronizarGasto(v: VencimientoServicio, responsable: Responsable) {
  if (!v.propiedadId || !v.fechaPago) return undefined;
  const monto = v.monto ?? undefined;
  if (v.gastoId && (await gastosRepo.obtenerPorId(v.gastoId))) {
    return (await gastosService.corregir({ gastoId: v.gastoId, monto, fechaPago: v.fechaPago, responsable }))?.despues;
  }
  const gasto = await gastosRepo.crearGasto({
    propiedadId: v.propiedadId,
    tipo: tipoGastoDeServicio(v.nombre),
    responsable,
    monto,
    periodicidad: "mensual",
    fechaVencimiento: v.fechaVencimiento,
    observaciones: `${v.nombre} de ${formatoPeriodoAR(v.periodo)} (vencimiento de servicio)`,
  });
  await serviciosRepo.guardarMes(v.servicioId, v.periodo, { gastoId: gasto.id });
  return gastosService.marcarPagado({ gastoId: gasto.id, fechaPago: v.fechaPago, monto });
}

export async function marcarPagado(
  servicioId: string,
  periodo: string,
  fechaPago: string,
  monto?: string,
  responsable?: Responsable,
) {
  await serviciosRepo.guardarMes(servicioId, periodo, { fechaPago, ...(monto ? { monto } : {}) });
  const v = await obtener(servicioId, periodo);
  if (!v) return undefined;
  const gasto = await sincronizarGasto(v, responsableDelPago(responsable));
  return { ...v, gastoId: gasto?.id ?? v.gastoId, gasto };
}

export async function cambiarFechaDelMes(servicioId: string, periodo: string, fecha: string) {
  await serviciosRepo.guardarMes(servicioId, periodo, { fechaVencimiento: fecha });
  return obtener(servicioId, periodo);
}

export async function cambiarDia(servicioId: string, dia: number) {
  await serviciosRepo.actualizar(servicioId, { diaVencimiento: dia });
  return obtener(servicioId);
}

export async function cambiarMonto(servicioId: string, monto: string) {
  await serviciosRepo.actualizar(servicioId, { monto });
  return obtener(servicioId);
}

export async function darDeBaja(servicioId: string) {
  await serviciosRepo.actualizar(servicioId, { activo: false });
}

// ---------- Textos ----------

const montoTexto = (monto: string | null, aprox = true) =>
  monto ? ` — ${aprox ? "aprox. " : ""}${formatoARS(monto)}` : "";

/** "⚡ Luz (Personal) — 15/11/2026 (vence en 3 días) — aprox. $12.000" (o "✅ pagado el ..."). */
export function lineaServicio(v: VencimientoServicio, hoy = hoyISO(), opciones?: { sinDuenio?: boolean }): string {
  const estado = v.fechaPago
    ? `✅ pagado el ${formatoFechaAR(v.fechaPago)}`
    : `${v.diasRestantes < 0 ? "⚠️ " : ""}${cuandoVence(hoy, v.fechaVencimiento)}`;
  const nombre = opciones?.sinDuenio ? `${iconoServicio(v.nombre)} ${v.nombre}` : nombreServicio(v.nombre, v.propiedad);
  return `${nombre} — ${formatoFechaAR(v.fechaVencimiento)} (${estado})${montoTexto(v.monto, !v.fechaPago)}`;
}

/**
 * Agrupa por de quién es: primero lo personal y después cada propiedad (por dirección), con un
 * título por grupo, así no se mezclan los servicios propios con los de las propiedades.
 */
function porDuenio(items: VencimientoServicio[], linea: (v: VencimientoServicio) => string): string[] {
  const grupos = new Map<string, VencimientoServicio[]>();
  for (const v of items) {
    const clave = v.propiedad ?? "";
    grupos.set(clave, [...(grupos.get(clave) ?? []), v]);
  }
  const claves = [...grupos.keys()].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
  return claves.flatMap((clave) => [clave === "" ? "👤 Personal" : `🏠 ${clave}`, ...grupos.get(clave)!.map(linea)]);
}

/** Mensaje del aviso que manda el bot solo. */
export function textoAviso(v: VencimientoServicio, tipo: TipoAviso, hoy = hoyISO()): string {
  const cabecera =
    tipo === "previo"
      ? "⏰ Se viene un vencimiento"
      : v.diasRestantes === 0
        ? "🔴 Vence hoy"
        : "⚠️ Venció y no está pago";
  return [
    cabecera,
    "",
    nombreServicio(v.nombre, v.propiedad),
    `${formatoFechaAR(v.fechaVencimiento)} — ${cuandoVence(hoy, v.fechaVencimiento)}`,
    v.monto ? `Monto aprox.: ${formatoARS(v.monto)}` : null,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/** Listado de un mes para Consultas y para la IA. */
export function textoDelMes(items: VencimientoServicio[], periodo: string, hoy = hoyISO()): string {
  if (items.length === 0) {
    return periodo < hoy.slice(0, 7)
      ? `📅 Servicios de ${formatoPeriodoAR(periodo)}\n\nNo había servicios agendados ese mes.`
      : "Todavía no cargaste vencimientos de servicios. Sumalos desde ➕ Nueva carga → 📅 Vencimiento.";
  }
  // Primero lo que falta pagar y abajo, aparte, lo ya pagado: que no se mezclen.
  const pendientes = items.filter((v) => !v.fechaPago).sort(porFecha);
  const pagados = items.filter((v) => v.fechaPago).sort((a, b) => a.fechaPago!.localeCompare(b.fechaPago!));
  const total = pendientes.reduce((acc, v) => acc + Number(v.monto ?? 0), 0);
  const pasado = periodo < hoy.slice(0, 7);
  const bloquePendientes =
    pendientes.length === 0
      ? ["✅ Todo pagado este mes."]
      : [
          `🕓 ${pasado ? "Quedó sin pagar" : "Falta pagar"} (${pendientes.length})${total > 0 ? ` — aprox. ${formatoARS(String(total))}` : ""}`,
          ...porDuenio(pendientes, (v) => `• ${lineaServicio(v, hoy, { sinDuenio: true })}`),
        ];
  const bloquePagados =
    pagados.length === 0
      ? []
      : [
          "",
          `✅ Pagados (${pagados.length})`,
          ...porDuenio(
            pagados,
            (v) =>
              `• ${iconoServicio(v.nombre)} ${v.nombre}${v.monto ? ` — ${formatoARS(v.monto)}` : ""} — el ${formatoFechaAR(v.fechaPago!)}`,
          ),
        ];
  return [`📅 Servicios de ${formatoPeriodoAR(periodo)}`, "", ...bloquePendientes, ...bloquePagados].join("\n");
}
