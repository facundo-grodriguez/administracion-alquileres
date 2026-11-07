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
  correspondeAlPeriodo,
  cuandoVence,
  iconoServicio,
  nombreServicio,
  periodoPendiente,
  periodoSiguiente,
  type TipoAviso,
  tipoGastoDeServicio,
  ultimoMesAlDarDeBaja,
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
  /** Último mes del servicio (última cuota o mes de la baja), o null si sigue sin fin. */
  hastaPeriodo: string | null;
  activo: boolean;
};

/** El vencimiento de un servicio en un mes (con lo pagado, si se pagó). */
export function vencimientoDelServicio(servicio: ServicioConDetalle, periodo: string, hoy = hoyISO()) {
  return armar(servicio, periodo, hoy);
}

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
    // Si el mes está vinculado a un gasto de la propiedad, lo que se pagó ahí cuenta acá (v9.12.0).
    fechaPago: mes?.fechaPago ?? mes?.gasto?.fechaPago ?? null,
    monto: mes?.monto ?? mes?.gasto?.monto ?? servicio.monto,
    gastoId: mes?.gastoId ?? null,
    diasRestantes: diasEntreISO(hoy, fechaVencimiento),
    hastaPeriodo: servicio.hastaPeriodo,
    activo: servicio.activo,
  };
}

const porFecha = (a: VencimientoServicio, b: VencimientoServicio) =>
  a.fechaVencimiento.localeCompare(b.fechaVencimiento) || a.nombre.localeCompare(b.nombre);

const tieneDatos = (s: ServicioConDetalle, periodo: string) => s.meses.some((m) => m.periodo === periodo);

/** Después de su último mes (última cuota o baja) un servicio ya no vence. */
const terminado = (s: { hastaPeriodo: string | null }, periodo: string) =>
  Boolean(s.hastaPeriodo && periodo > s.hastaPeriodo);

/**
 * Los servicios de un mes (pagados o no), ordenados por fecha. No aparecen los cargados después de
 * ese mes ni los que ya habían terminado; los dados de baja siguen apareciendo hasta su último mes.
 */
export async function delMes(periodo?: string, hoy = hoyISO()): Promise<VencimientoServicio[]> {
  const p = periodo ?? hoy.slice(0, 7);
  return (await serviciosRepo.listarTodos())
    .filter((s) => correspondeAlPeriodo(s, p, tieneDatos(s, p)))
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
      if (terminado(s, periodo)) continue;
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
 * hasta este mes (o un mes que viene si ya se pagó por adelantado), sin pasar de su último mes.
 */
export async function historialPersonales(hoy = hoyISO()): Promise<VencimientoServicio[]> {
  const actual = hoy.slice(0, 7);
  const items: VencimientoServicio[] = [];
  for (const s of await serviciosRepo.listarTodos()) {
    if (s.propiedadId) continue;
    const creado = `${s.createdAt.getFullYear()}-${String(s.createdAt.getMonth() + 1).padStart(2, "0")}`;
    const conDatos = s.meses.map((m) => m.periodo).sort();
    const desde = [creado, ...conDatos].sort()[0]!;
    const hasta = [actual, ...conDatos].sort().at(-1)!;
    for (const periodo of periodosEntre(desde, hasta)) {
      const datos = tieneDatos(s, periodo);
      if (periodo > actual && !datos) continue;
      if (correspondeAlPeriodo(s, periodo, datos)) items.push(armar(s, periodo, hoy));
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
      if (terminado(s, periodo)) continue;
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
  hastaPeriodo?: string | null;
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

/** Resultado de vincular un gasto cargado a mano con el vencimiento del mismo servicio. */
export type Vinculo = { nombre: string; periodo: string; yaEstaba: boolean };

/**
 * Sin duplicados (v9.12.0): si se carga a mano un gasto de una propiedad (ej. Luz de Cerrito de
 * noviembre) y esa propiedad tiene agendado el vencimiento de ese servicio, el mes del vencimiento
 * queda vinculado al gasto: cuenta como pagado cuando se paga el gasto, y no aparece dos veces en
 * "sin pagar". Si ese mes ya tenía otro gasto (se pagó desde el vencimiento), avisa `yaEstaba`.
 * Los gastos "otro" y los arreglos no se vinculan.
 */
export async function vincularGasto(gasto: {
  id: string;
  propiedadId: string;
  tipo: string;
  fechaVencimiento: string;
}): Promise<Vinculo | undefined> {
  if (gasto.tipo === "otro" || gasto.tipo === "reparacion") return undefined;
  const periodo = gasto.fechaVencimiento.slice(0, 7);
  const servicio = (await serviciosRepo.listarActivos()).find(
    (s) =>
      s.propiedadId === gasto.propiedadId && tipoGastoDeServicio(s.nombre) === gasto.tipo && !terminado(s, periodo),
  );
  if (!servicio) return undefined;
  const mes = servicio.meses.find((m) => m.periodo === periodo);
  if (mes?.gastoId && mes.gastoId !== gasto.id) return { nombre: servicio.nombre, periodo, yaEstaba: true };
  await serviciosRepo.guardarMes(servicio.id, periodo, { gastoId: gasto.id });
  return { nombre: servicio.nombre, periodo, yaEstaba: false };
}

/** Texto para la respuesta al cargar un gasto vinculado. */
export function textoVinculo(v: Vinculo): string {
  const cual = `${iconoServicio(v.nombre)} ${v.nombre} de ${formatoPeriodoAR(v.periodo)}`;
  return v.yaEstaba
    ? `⚠️ Ojo: ${cual} ya estaba cargado desde el vencimiento. Si es el mismo pago, corregí o borrá uno de los dos.`
    : `🔗 Es ${cual} del vencimiento agendado: quedan vinculados y no figura dos veces.`;
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

/**
 * Deja de avisar, pero sin borrar el seguimiento: queda todo hasta este mes si ya tiene algo cargado
 * (si no, hasta el anterior). Devuelve el último mes que queda.
 */
export async function darDeBaja(servicioId: string, hoy = hoyISO()): Promise<string | undefined> {
  const s = await serviciosRepo.obtenerPorId(servicioId);
  if (!s) return undefined;
  const hasta = ultimoMesAlDarDeBaja(hoy, tieneDatos(s, hoy.slice(0, 7)), s.hastaPeriodo);
  await serviciosRepo.actualizar(servicioId, { activo: false, hastaPeriodo: hasta });
  return hasta;
}

/** Último mes (última cuota): después de ese mes no avisa más. null = todos los meses, sin fin. */
export async function cambiarHasta(servicioId: string, hastaPeriodo: string | null) {
  await serviciosRepo.actualizar(servicioId, { hastaPeriodo });
  return obtener(servicioId);
}

// ---------- Textos ----------

/** El mes es el último de un servicio que termina (no el de una baja). */
export const esUltimaCuota = (v: VencimientoServicio) => v.activo && v.hastaPeriodo === v.periodo;

const montoTexto = (monto: string | null, aprox = true) =>
  monto ? ` — ${aprox ? "aprox. " : ""}${formatoARS(monto)}` : "";

/** "⚡ Luz (Personal) — 15/11/2026 (vence en 3 días) — aprox. $12.000" (o "✅ pagado el ..."). */
export function lineaServicio(v: VencimientoServicio, hoy = hoyISO(), opciones?: { sinDuenio?: boolean }): string {
  const estado = v.fechaPago
    ? `✅ pagado el ${formatoFechaAR(v.fechaPago)}`
    : `${v.diasRestantes < 0 ? "⚠️ " : ""}${cuandoVence(hoy, v.fechaVencimiento)}`;
  const nombre = opciones?.sinDuenio ? `${iconoServicio(v.nombre)} ${v.nombre}` : nombreServicio(v.nombre, v.propiedad);
  return `${nombre} — ${formatoFechaAR(v.fechaVencimiento)} (${estado})${montoTexto(v.monto, !v.fechaPago)}${esUltimaCuota(v) ? " — última cuota" : ""}`;
}

/** Suma de los montos (los que no tienen monto no suman). */
const total = (items: VencimientoServicio[]) => items.reduce((acc, v) => acc + Number(v.monto ?? 0), 0);

/**
 * Agrupa por de quién es: primero lo personal y después cada propiedad (por dirección), con un
 * título por grupo y una línea en blanco antes de cada uno, así no se mezclan.
 */
function porDuenio(
  items: VencimientoServicio[],
  linea: (v: VencimientoServicio) => string,
  subtotal: (monto: number) => string,
): string[] {
  const grupos = new Map<string, VencimientoServicio[]>();
  for (const v of items) {
    const clave = v.propiedad ?? "";
    grupos.set(clave, [...(grupos.get(clave) ?? []), v]);
  }
  const claves = [...grupos.keys()].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
  return claves.flatMap((clave) => {
    const grupo = grupos.get(clave)!;
    const monto = total(grupo);
    return [
      "",
      `${clave === "" ? "👤 Personal" : `🏠 ${clave}`}${monto > 0 ? ` — ${subtotal(monto)}` : ""}`,
      ...grupo.map(linea),
    ];
  });
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

export type FiltroServicios = "todos" | "personal" | "propiedades";

/** Solo los personales, solo los de propiedades, o todos. */
export function filtrarServicios(items: VencimientoServicio[], filtro: FiltroServicios = "todos") {
  if (filtro === "personal") return items.filter((v) => !v.propiedadId);
  if (filtro === "propiedades") return items.filter((v) => v.propiedadId);
  return items;
}

const TITULO_FILTRO: Record<FiltroServicios, string> = {
  todos: "",
  personal: " — 👤 Personal",
  propiedades: " — 🏠 Propiedades",
};

/** Listado de un mes para Consultas y para la IA (ya filtrado; `filtro` solo cambia el título). */
export function textoDelMes(
  items: VencimientoServicio[],
  periodo: string,
  hoy = hoyISO(),
  filtro: FiltroServicios = "todos",
): string {
  const titulo = `📅 Servicios de ${formatoPeriodoAR(periodo)}${TITULO_FILTRO[filtro]}`;
  if (items.length === 0 && filtro !== "todos") {
    return `${titulo}\n\nNo hay servicios ${filtro === "personal" ? "personales" : "de propiedades"} ese mes.`;
  }
  if (items.length === 0) {
    return periodo < hoy.slice(0, 7)
      ? `${titulo}\n\nNo había servicios agendados ese mes.`
      : "Todavía no cargaste vencimientos de servicios. Sumalos desde ➕ Nueva carga → 📅 Vencimiento.";
  }
  // Primero lo que falta pagar y abajo, aparte, lo ya pagado: que no se mezclen.
  const pendientes = items.filter((v) => !v.fechaPago).sort(porFecha);
  const pagados = items.filter((v) => v.fechaPago).sort((a, b) => a.fechaPago!.localeCompare(b.fechaPago!));
  const falta = total(pendientes);
  const pagado = total(pagados);
  const pasado = periodo < hoy.slice(0, 7);
  const bloquePendientes =
    pendientes.length === 0
      ? ["✅ Todo pagado este mes."]
      : [
          `🕓 ${pasado ? "Quedó sin pagar" : "Falta pagar"} (${pendientes.length})${falta > 0 ? ` — aprox. ${formatoARS(String(falta))}` : ""}`,
          ...porDuenio(
            pendientes,
            (v) => `• ${lineaServicio(v, hoy, { sinDuenio: true })}`,
            (m) => `aprox. ${formatoARS(String(m))}`,
          ),
        ];
  const bloquePagados =
    pagados.length === 0
      ? []
      : [
          "",
          `✅ Pagados (${pagados.length})${pagado > 0 ? ` — total ${formatoARS(String(pagado))}` : ""}`,
          ...porDuenio(
            pagados,
            (v) =>
              `• ${iconoServicio(v.nombre)} ${v.nombre}${v.monto ? ` — ${formatoARS(v.monto)}` : ""} — el ${formatoFechaAR(v.fechaPago!)}`,
            (m) => formatoARS(String(m)),
          ),
        ];
  return [titulo, "", ...bloquePendientes, ...bloquePagados].join("\n");
}
