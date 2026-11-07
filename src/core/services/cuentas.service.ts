// Cuentas personales (v9.13.0): el presupuesto del mes del administrador, como su planilla
// "Cuentas": rubros con un monto previsto (Compras, Nafta, Seguro...), el sueldo, y cuánto sobra.
// Lo real de cada rubro es el total que se carga ese mes o, si está vinculado a un vencimiento
// personal (Seguro auto, Claude...), lo que se pagó ahí. No toca nada de las propiedades.
import * as cuentasRepo from "../repositories/cuentas.repository.js";
import * as serviciosRepo from "../repositories/serviciosVencimiento.repository.js";
import { formatoFechaAR, formatoPeriodoAR, hoyISO } from "../util/fecha.js";
import { formatoARS } from "../util/formato.js";
import { parsearListaCuentas } from "../util/listaCuentas.js";
import * as serviciosService from "./serviciosVencimiento.service.js";

type Rubro = Awaited<ReturnType<typeof cuentasRepo.listarActivos>>[number];
export type TipoRubro = "gasto" | "ingreso";

export type LineaCuenta = {
  rubroId: string;
  nombre: string;
  tipo: TipoRubro;
  previsto: number | null;
  /** Lo que se gastó (o cobró) de verdad ese mes, si ya se sabe. */
  real: number | null;
  /** Si está vinculado a un vencimiento: cuándo vence y si se pagó. */
  vencimiento?: { fecha: string; pagado: boolean };
  vinculadoA?: string;
};

export type CuentasDelMes = {
  periodo: string;
  gastos: LineaCuenta[];
  ingresos: LineaCuenta[];
  totales: {
    ingreso: number;
    previsto: number;
    gastado: number;
    /** Lo real donde ya se sabe y lo previsto en el resto. */
    proyectado: number;
    sobraPrevista: number;
    sobraProyectada: number;
  };
};

const num = (v: string | null | undefined) => (v === null || v === undefined ? null : Number(v));
const mesDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

function linea(r: Rubro, periodo: string, hoy: string): LineaCuenta {
  const mes = r.meses.find((m) => m.periodo === periodo);
  const v = r.servicio ? serviciosService.vencimientoDelServicio(r.servicio, periodo, hoy) : undefined;
  const previsto = num(mes?.previsto) ?? num(r.previsto) ?? num(v?.monto);
  // Lo cargado a mano manda; si no, lo pagado en el vencimiento vinculado.
  const real = num(mes?.real) ?? (v?.fechaPago ? num(v.monto) : null);
  return {
    rubroId: r.id,
    nombre: r.nombre,
    tipo: r.tipo === "ingreso" ? "ingreso" : "gasto",
    previsto,
    real,
    vencimiento: v ? { fecha: v.fechaVencimiento, pagado: Boolean(v.fechaPago) } : undefined,
    vinculadoA: r.servicio?.nombre,
  };
}

/** Un rubro cuenta desde el mes en que se creó (o el primero que tenga algo cargado). */
const cuentaEn = (r: Rubro, periodo: string) =>
  mesDe(r.createdAt) <= periodo || r.meses.some((m) => m.periodo === periodo);

export async function cuentasDelMes(periodo?: string, hoy = hoyISO()): Promise<CuentasDelMes> {
  const p = periodo ?? hoy.slice(0, 7);
  const lineas = (await cuentasRepo.listarActivos()).filter((r) => cuentaEn(r, p)).map((r) => linea(r, p, hoy));
  const gastos = lineas.filter((l) => l.tipo === "gasto");
  const ingresos = lineas.filter((l) => l.tipo === "ingreso");
  const suma = (ls: LineaCuenta[], f: (l: LineaCuenta) => number | null) => ls.reduce((acc, l) => acc + (f(l) ?? 0), 0);
  const ingreso = suma(ingresos, (l) => l.real ?? l.previsto);
  const previsto = suma(gastos, (l) => l.previsto);
  const gastado = suma(gastos, (l) => l.real);
  const proyectado = suma(gastos, (l) => l.real ?? l.previsto);
  return {
    periodo: p,
    gastos,
    ingresos,
    totales: {
      ingreso,
      previsto,
      gastado,
      proyectado,
      sobraPrevista: ingreso - previsto,
      sobraProyectada: ingreso - proyectado,
    },
  };
}

/** Los meses que tienen cuentas, del primero a este (para la planilla). */
export async function mesesConCuentas(hoy = hoyISO()): Promise<string[]> {
  const rubros = await cuentasRepo.listarActivos();
  if (rubros.length === 0) return [];
  const actual = hoy.slice(0, 7);
  const todos = rubros.flatMap((r) => [mesDe(r.createdAt), ...r.meses.map((m) => m.periodo)]).sort();
  const desde = todos[0]!;
  const hasta = [actual, ...todos].sort().at(-1)!;
  const meses: string[] = [];
  for (let p = desde; p <= hasta; ) {
    meses.push(p);
    const [a, m] = p.split("-").map(Number) as [number, number];
    p = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
  }
  return meses;
}

// ---------- Alta, cambios y carga ----------

const normalizar = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Busca un rubro por nombre: igual, o que empiece / contenga lo escrito. */
export async function buscarRubro(nombre: string): Promise<Rubro | undefined> {
  const q = normalizar(nombre);
  const rubros = await cuentasRepo.listarActivos();
  return (
    rubros.find((r) => normalizar(r.nombre) === q) ??
    rubros.find((r) => normalizar(r.nombre).startsWith(q) || q.startsWith(normalizar(r.nombre))) ??
    rubros.find((r) => normalizar(r.nombre).includes(q))
  );
}

/** El vencimiento personal que corresponde a un nombre ("Seguro" → "Seguro auto", "Gp" → "Moto GP"). */
async function buscarVencimientoPersonal(nombre: string) {
  const q = normalizar(nombre);
  const personales = (await serviciosRepo.listarActivos()).filter((s) => !s.propiedadId);
  return (
    personales.find((s) => normalizar(s.nombre) === q) ??
    personales.find((s) => normalizar(s.nombre).startsWith(q) || q.startsWith(normalizar(s.nombre))) ??
    personales.find((s) => normalizar(s.nombre).split(/\s+/).includes(q.split(/\s+/)[0]!))
  );
}

export type ResultadoConfigurar = {
  accion: "creado" | "actualizado" | "quitado";
  nombre: string;
  tipo: TipoRubro;
  previsto: string | null;
  vinculadoA?: string;
  /** Se pidió vincular a un vencimiento que no existe. */
  vencimientoNoEncontrado?: string;
};

/**
 * Crea o cambia un rubro. La reserva y el vencimiento van por separado salvo que se pida vincularlos:
 * `vencimiento` = nombre del vencimiento personal a vincular (lo real pasa a ser lo pagado ahí),
 * `desvincular` lo separa. `quitar` lo saca de las cuentas (lo cargado queda guardado).
 */
export async function configurarRubro(input: {
  nombre: string;
  tipo?: TipoRubro;
  previsto?: string;
  vencimiento?: string;
  desvincular?: boolean;
  quitar?: boolean;
}): Promise<ResultadoConfigurar | undefined> {
  const existente = await buscarRubro(input.nombre);
  const exacto = existente && normalizar(existente.nombre) === normalizar(input.nombre) ? existente : undefined;
  if (input.quitar) {
    if (!existente) return undefined;
    await cuentasRepo.actualizar(existente.id, { activo: false });
    return {
      accion: "quitado",
      nombre: existente.nombre,
      tipo: existente.tipo as TipoRubro,
      previsto: existente.previsto,
    };
  }
  const tipo =
    input.tipo ??
    (exacto?.tipo as TipoRubro | undefined) ??
    (/sueldo|ingreso|cobro/i.test(input.nombre) ? "ingreso" : "gasto");
  const pideVincular = tipo === "gasto" && !input.desvincular && Boolean(input.vencimiento?.trim());
  const servicio = pideVincular ? await buscarVencimientoPersonal(input.vencimiento!) : undefined;
  const vencimientoNoEncontrado = pideVincular && !servicio ? input.vencimiento!.trim() : undefined;
  if (exacto) {
    const sinVinculo = input.desvincular || tipo === "ingreso";
    const r = await cuentasRepo.actualizar(exacto.id, {
      tipo,
      ...(input.previsto !== undefined ? { previsto: input.previsto } : {}),
      ...(servicio ? { servicioId: servicio.id } : sinVinculo ? { servicioId: null } : {}),
    });
    return {
      accion: "actualizado",
      nombre: r!.nombre,
      tipo,
      previsto: r!.previsto,
      vinculadoA: sinVinculo ? undefined : (servicio?.nombre ?? exacto.servicio?.nombre),
      vencimientoNoEncontrado,
    };
  }
  const orden = (await cuentasRepo.listarActivos()).length;
  const nombre = input.nombre.trim().replace(/^./, (c) => c.toUpperCase());
  const r = await cuentasRepo.crear({
    nombre,
    tipo,
    previsto: input.previsto ?? null,
    servicioId: servicio?.id ?? null,
    orden,
  });
  return {
    accion: "creado",
    nombre: r.nombre,
    tipo,
    previsto: r.previsto,
    vinculadoA: servicio?.nombre,
    vencimientoNoEncontrado,
  };
}

/**
 * Arma o cambia varios rubros de una lista escrita, sin IA (comando /cuentas). Devuelve qué hizo
 * con cada línea, para mostrarlo.
 */
export async function aplicarLista(texto: string): Promise<string[]> {
  const hechos: string[] = [];
  for (const item of parsearListaCuentas(texto)) {
    if (item.tipo === "error") {
      hechos.push(`⚠️ No entendí "${item.texto}": poné el nombre y el monto (ej. Nafta 100000).`);
    } else if (item.tipo === "quitar") {
      const r = await configurarRubro({ nombre: item.nombre, quitar: true });
      hechos.push(r ? `🗑️ Saqué ${r.nombre}` : `⚠️ No encontré ${item.nombre} en tus cuentas.`);
    } else {
      const r = await configurarRubro({
        nombre: item.nombre,
        previsto: item.previsto,
        tipo: item.ingreso ? "ingreso" : undefined,
        vencimiento: item.vencimiento,
        desvincular: item.desvincular,
      });
      if (r) hechos.push(lineaConfigurada(r));
    }
  }
  return hechos;
}

export type ModoCarga = "total" | "sumar" | "previsto";

/**
 * Carga lo de un mes: "total" (lo gastado/cobrado ese mes, reemplaza), "sumar" (se agrega a lo que
 * había) o "previsto" (otro previsto solo para ese mes).
 */
export async function cargar(input: { rubro: string; monto: string; periodo?: string; modo?: ModoCarga }) {
  const rubro = await buscarRubro(input.rubro);
  if (!rubro) return undefined;
  const periodo = input.periodo ?? hoyISO().slice(0, 7);
  const modo = input.modo ?? "total";
  if (modo === "previsto") {
    await cuentasRepo.guardarMes(rubro.id, periodo, { previsto: input.monto });
  } else {
    const antes = modo === "sumar" ? (num((await cuentasRepo.obtenerMes(rubro.id, periodo))?.real) ?? 0) : 0;
    await cuentasRepo.guardarMes(rubro.id, periodo, { real: String(antes + Number(input.monto)) });
  }
  const cuentas = await cuentasDelMes(periodo);
  const l = [...cuentas.gastos, ...cuentas.ingresos].find((x) => x.rubroId === rubro.id)!;
  return { rubro: rubro.nombre, periodo, modo, linea: l, cuentas };
}

// ---------- Textos ----------

const $ = (n: number) => formatoARS(String(n));
const diaMes = (iso: string) => formatoFechaAR(iso).slice(0, 5);

/** "• ✅ Compras — $ 230.000 (previsto $ 250.000)" y parecidos. */
export function lineaCuenta(l: LineaCuenta): string {
  const previsto = l.previsto !== null ? $(l.previsto) : "sin previsto";
  if (l.real !== null) {
    const extra = l.previsto !== null && l.previsto !== l.real ? ` (previsto ${previsto})` : "";
    return `• ✅ ${l.nombre} — ${$(l.real)}${extra}`;
  }
  if (l.vencimiento && !l.vencimiento.pagado) {
    return `• 🕓 ${l.nombre} — ${previsto} · vence ${diaMes(l.vencimiento.fecha)}`;
  }
  return `• ▫️ ${l.nombre} — ${previsto}`;
}

/** Cómo armar o cambiar las cuentas con /cuentas (sin IA). */
export const TEXTO_COMO_ARMAR = [
  "Para armarlas o cambiarlas, mandá /cuentas y abajo la lista (un rubro por línea, con lo que reservás por mes):",
  "",
  "/cuentas",
  "Sueldo 1020935",
  "Compras 250000",
  "Nafta 100000",
  "Seguro 110000 (vencimiento Seguro auto)",
  "",
  "• El sueldo (o lo que diga ingreso) va como ingreso.",
  "• (vencimiento X) lo vincula a ese vencimiento: lo gastado pasa a ser lo que pagues ahí. Sin eso, la reserva va por su lado.",
  "• (sin vincular) lo separa · quitar Nafta lo saca.",
  "• Si el rubro ya existe, le cambia el monto.",
  "",
  "También podés usar el botón ⚙️ Rubros.",
].join("\n");

export const TEXTO_SIN_CUENTAS = `Todavía no armaste tus cuentas.\n\n${TEXTO_COMO_ARMAR}`;

export function textoCuentas(c: CuentasDelMes, hoy = hoyISO()): string {
  const titulo = `📒 Cuentas de ${formatoPeriodoAR(c.periodo)}`;
  if (c.gastos.length + c.ingresos.length === 0) return `${titulo}\n\n${TEXTO_SIN_CUENTAS}`;
  const t = c.totales;
  const pasado = c.periodo < hoy.slice(0, 7);
  const lineas = [titulo, ""];
  for (const i of c.ingresos)
    lineas.push(`💵 ${i.nombre} — ${$(i.real ?? i.previsto ?? 0)}${i.real === null ? " (previsto)" : ""}`);
  lineas.push(`🧾 Gastos previstos — ${$(t.previsto)}`);
  if (c.ingresos.length > 0) lineas.push(`💰 Sobra — ${$(t.sobraPrevista)}`);
  lineas.push(
    "",
    `${pasado ? "Cómo terminó" : "Con lo cargado hasta ahora"}:`,
    `✅ Gastado — ${$(t.gastado)} de ${$(t.previsto)}`,
  );
  if (c.ingresos.length > 0 && t.proyectado !== t.gastado) {
    lineas.push(`💰 Sobraría — ${$(t.sobraProyectada)} (con lo previsto en lo que falta)`);
  } else if (c.ingresos.length > 0) {
    lineas.push(`💰 Sobra — ${$(t.sobraProyectada)}`);
  }
  lineas.push("", ...c.gastos.map(lineaCuenta));
  lineas.push("", "✅ cargado o pagado · 🕓 vence · ▫️ todavía previsto");
  return lineas.join("\n");
}

/** "➕ 🧾 Compras — $ 250.000" (para la lista de /cuentas). */
export function lineaConfigurada(r: ResultadoConfigurar): string {
  const marca = r.accion === "creado" ? "➕" : "✏️";
  const tipo = r.tipo === "ingreso" ? "💵" : "🧾";
  return [
    `${marca} ${tipo} ${r.nombre}${r.previsto ? ` — ${formatoARS(r.previsto)}` : ""}`,
    r.vinculadoA ? ` · 🔗 ${r.vinculadoA}` : "",
    r.vencimientoNoEncontrado ? ` · ⚠️ no encontré el vencimiento ${r.vencimientoNoEncontrado}, quedó sin vincular` : "",
  ].join("");
}

export function textoConfigurar(r: ResultadoConfigurar): string {
  if (r.accion === "quitado") return `Listo, saqué ${r.nombre} de tus cuentas. Lo ya cargado queda guardado.`;
  const tipo = r.tipo === "ingreso" ? "💵 ingreso" : "🧾 gasto";
  return [
    `${r.accion === "creado" ? "Agregué" : "Actualicé"} ${r.nombre} (${tipo})${r.previsto ? ` — previsto ${formatoARS(r.previsto)} por mes` : ""}.`,
    r.vinculadoA ? `🔗 Vinculado al vencimiento ${r.vinculadoA}: lo real es lo que pagues ahí.` : null,
    r.vencimientoNoEncontrado
      ? `⚠️ No encontré el vencimiento ${r.vencimientoNoEncontrado}: quedó sin vincular, como reserva aparte.`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}
