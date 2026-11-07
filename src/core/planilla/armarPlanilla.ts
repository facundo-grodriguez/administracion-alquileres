// Arma el contenido de la planilla de Google (v9.10.0) a partir de la base: una pestaña por tema.
// No sabe nada de Google: devuelve tablas (títulos, columnas y filas) que después se escriben tal cual.
import * as contratosRepo from "../repositories/contratos.repository.js";
import * as gastosRepo from "../repositories/gastosPropiedad.repository.js";
import * as propiedadesRepo from "../repositories/propiedades.repository.js";
import { valorVigente } from "../services/actualizacionAlquiler.service.js";
import * as cuentasService from "../services/cuentas.service.js";
import { calcularBalance } from "../services/movimientos.service.js";
import { historialPagos, type PeriodoHistorial } from "../services/pagos.service.js";
import * as serviciosService from "../services/serviciosVencimiento.service.js";
import { formatoPeriodoAR, hoyISO } from "../util/fecha.js";
import { entraEnBalance } from "../util/responsableGasto.js";
import { nombreRubro } from "../util/rubroGasto.js";
import { tipoGastoDeServicio } from "../util/vencimientoServicio.js";

/** Texto, número o fecha ISO (YYYY-MM-DD); null = celda vacía. */
export type Celda = string | number | null;
export type TipoColumna = "texto" | "fecha" | "mes" | "monto";
export type Columna = { titulo: string; tipo?: TipoColumna };
export type Color = { red: number; green: number; blue: number };
export type Pestana = {
  titulo: string;
  columnas: Columna[];
  filas: Celda[][];
  /** Fondo de cada celda (mismo orden que `filas`); null = sin color. */
  fondos?: (Color | null)[][];
  /** Índices de `filas` que van en negrita (los totales). */
  negritas?: number[];
  /** Columnas fijas a la izquierda al desplazarse (además del encabezado). */
  columnasFijas?: number;
  /** Sin filtro en el encabezado (un cuadro de meses no se filtra por columna). */
  sinFiltro?: boolean;
};

export const COLORES = {
  pagado: { red: 0.85, green: 0.94, blue: 0.85 },
  vencido: { red: 0.98, green: 0.85, blue: 0.85 },
  pendiente: { red: 1, green: 0.95, blue: 0.8 },
} satisfies Record<string, Color>;

export const PESTANAS = {
  resumen: "Resumen",
  alquileres: "Alquileres",
  gastos: "Gastos propiedades",
  personales: "Servicios personales",
  cuentas: "Cuentas",
} as const;

const ESTADO_PAGO: Record<string, string> = {
  pagado: "Pagado",
  pendiente: "Pendiente",
  atrasado: "Atrasado",
  parcial: "Parcial",
};

const num = (monto: string | null | undefined): number | null => (monto ? Number(monto) : null);
const primeroDeMes = (periodo: string) => `${periodo.slice(0, 7)}-01`;

type Contrato = Awaited<ReturnType<typeof contratosRepo.listarTodos>>[number];

async function alquileres(contratos: Contrato[], historiales: Map<string, PeriodoHistorial[]>): Promise<Pestana> {
  const filas: { orden: string; fila: Celda[] }[] = [];
  for (const c of contratos) {
    for (const h of historiales.get(c.id) ?? []) {
      filas.push({
        orden: `${h.periodo}|${c.propiedad.direccion}`,
        fila: [
          primeroDeMes(h.periodo),
          c.propiedad.direccion,
          c.inquilino.nombreCompleto,
          num(h.monto),
          h.fechaVencimiento,
          ESTADO_PAGO[h.estado] ?? h.estado,
          h.fechaPago,
        ],
      });
    }
  }
  // El mes más nuevo arriba; dentro del mes, por dirección.
  filas.sort((a, b) => {
    const [pa, da] = a.orden.split("|") as [string, string];
    const [pb, db] = b.orden.split("|") as [string, string];
    return pb.localeCompare(pa) || da.localeCompare(db);
  });
  return {
    titulo: PESTANAS.alquileres,
    columnas: [
      { titulo: "Mes", tipo: "mes" },
      { titulo: "Propiedad" },
      { titulo: "Inquilino" },
      { titulo: "Monto", tipo: "monto" },
      { titulo: "Vence", tipo: "fecha" },
      { titulo: "Estado" },
      { titulo: "Pagado el", tipo: "fecha" },
    ],
    filas: filas.map((f) => f.fila),
  };
}

/**
 * Gastos de las propiedades, del más nuevo al más viejo. Suma los vencimientos de servicios de
 * propiedades que todavía no se pagaron (v9.12.0): así lo que falta pagar está todo junto.
 */
async function gastos(hoy: string): Promise<Pestana> {
  const todos = await gastosRepo.listarTodos();
  const servicios = (await serviciosService.paraPagar(hoy)).filter((v) => v.propiedadId && !v.gastoId);
  const filasGastos: Celda[][] = todos.map((g) => [
    g.fechaVencimiento,
    g.propiedad.direccion,
    nombreRubro(g.tipo),
    g.observaciones,
    g.responsable === "inquilino" ? "Inquilino" : g.responsable === "propietario" ? "Propietario" : null,
    num(g.monto),
    g.fechaPago ? "Pagado" : "Pendiente",
    g.fechaPago,
    entraEnBalance(g) ? "Sí" : "No",
  ]);
  const filasServicios: Celda[][] = servicios.map((v) => [
    v.fechaVencimiento,
    v.propiedad,
    nombreRubro(tipoGastoDeServicio(v.nombre)),
    `${v.nombre} de ${formatoPeriodoAR(v.periodo)} (vencimiento, monto aprox.)`,
    null,
    num(v.monto),
    v.fechaVencimiento < hoy ? "Vencido" : "Pendiente",
    null,
    "Al pagarlo",
  ]);
  const filas = [...filasServicios, ...filasGastos].sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  return {
    titulo: PESTANAS.gastos,
    columnas: [
      { titulo: "Vence", tipo: "fecha" },
      { titulo: "Propiedad" },
      { titulo: "Rubro" },
      { titulo: "Detalle" },
      { titulo: "Quién paga" },
      { titulo: "Monto", tipo: "monto" },
      { titulo: "Estado" },
      { titulo: "Pagado el", tipo: "fecha" },
      { titulo: "Resta del balance" },
    ],
    filas,
  };
}

type Personal = serviciosService.VencimientoServicio;

/** Solo el monto; el estado va en el color (sin monto cargado, un ✓ o un –). */
function celdaPersonal(v: Personal, hoy: string): { valor: Celda; fondo: Color } {
  const fondo = v.fechaPago ? COLORES.pagado : v.fechaVencimiento < hoy ? COLORES.vencido : COLORES.pendiente;
  return { valor: v.monto ? Number(v.monto) : v.fechaPago ? "✓" : "–", fondo };
}

const LEYENDA = "🟩 pagado   🟨 por vencer   🟥 vencido sin pagar";

/** "Última cuota Diciembre 2026", "Dado de baja (hasta Noviembre 2026)" o vacío si sigue sin fin. */
function termina(v: Personal): string | null {
  if (v.activo) return v.hastaPeriodo ? `Última cuota ${formatoPeriodoAR(v.hastaPeriodo)}` : null;
  return v.hastaPeriodo ? `Dado de baja (hasta ${formatoPeriodoAR(v.hastaPeriodo)})` : "Dado de baja";
}

/**
 * Cuadro de servicios personales (v9.11.0): una fila por servicio y una columna por mes (el más
 * nuevo a la izquierda). Cada celda es solo el monto y el estado va en el color; abajo, el total
 * pagado y por pagar de cada mes.
 */
async function personales(hoy: string): Promise<Pestana> {
  const items = await serviciosService.historialPersonales(hoy);
  const meses = [...new Set(items.map((v) => v.periodo))].sort().reverse();
  const servicios = new Map<string, Personal[]>();
  for (const v of items) servicios.set(v.servicioId, [...(servicios.get(v.servicioId) ?? []), v]);
  const orden = [...servicios.values()].sort(
    (a, b) => a[0]!.diaVencimiento - b[0]!.diaVencimiento || a[0]!.nombre.localeCompare(b[0]!.nombre),
  );

  const filas: Celda[][] = [];
  const fondos: (Color | null)[][] = [];
  const pagado = meses.map(() => 0);
  const falta = meses.map(() => 0);
  for (const delServicio of orden) {
    const primero = delServicio[0]!;
    const fila: Celda[] = [primero.nombre, `día ${primero.diaVencimiento}`, termina(primero)];
    const fondo: (Color | null)[] = [null, null, null];
    meses.forEach((periodo, i) => {
      const v = delServicio.find((m) => m.periodo === periodo);
      if (!v) {
        fila.push(null);
        fondo.push(null);
        return;
      }
      const c = celdaPersonal(v, hoy);
      fila.push(c.valor);
      fondo.push(c.fondo);
      if (v.fechaPago) pagado[i]! += Number(v.monto ?? 0);
      else falta[i]! += Number(v.monto ?? 0);
    });
    filas.push(fila);
    fondos.push(fondo);
  }
  const negritas: number[] = [];
  if (orden.length > 0) {
    filas.push([]);
    negritas.push(filas.length, filas.length + 1);
    filas.push(["Pagado", null, null, ...pagado]);
    filas.push(["Falta pagar", null, null, ...falta]);
    filas.push([], [LEYENDA]);
  }
  return {
    titulo: PESTANAS.personales,
    columnas: [
      { titulo: "Servicio" },
      { titulo: "Vence" },
      { titulo: "Termina" },
      ...meses.map((m) => ({ titulo: formatoPeriodoAR(m), tipo: "monto" as const })),
    ],
    filas,
    fondos,
    negritas,
    columnasFijas: 1,
    sinFiltro: true,
  };
}

const LEYENDA_CUENTAS = "🟨 ese mes fue distinto a lo reservado   sin color: lo reservado";

/**
 * "Cuentas" (v9.13.0): el presupuesto personal como lo anota el administrador. Una fila por rubro y
 * una columna por mes (el más nuevo a la izquierda): lo reservado o, si ese mes fue distinto, lo
 * modificado (en amarillo).
 * Abajo, el total de gastos, el sueldo y lo que sobra.
 */
async function cuentas(hoy: string): Promise<Pestana> {
  const meses = (await cuentasService.mesesConCuentas(hoy)).reverse();
  const porMes = await Promise.all(meses.map((m) => cuentasService.cuentasDelMes(m, hoy)));
  const columnas: Columna[] = [
    { titulo: "Rubro" },
    ...meses.map((m) => ({ titulo: formatoPeriodoAR(m), tipo: "monto" as const })),
  ];
  if (meses.length === 0) {
    return {
      titulo: PESTANAS.cuentas,
      columnas,
      filas: [[cuentasService.TEXTO_SIN_CUENTAS.split("\n")[0]!]],
      sinFiltro: true,
    };
  }
  // Los rubros, en el orden del mes más nuevo (incluye los que se sumaron después).
  const rubros = new Map<string, { nombre: string; tipo: string }>();
  for (const c of porMes) for (const l of [...c.gastos, ...c.ingresos]) rubros.set(l.rubroId, l);
  const filas: Celda[][] = [];
  const fondos: (Color | null)[][] = [];
  const fila = (id: string) => {
    const valores: Celda[] = [rubros.get(id)!.nombre];
    const colores: (Color | null)[] = [null];
    for (const c of porMes) {
      const l = [...c.gastos, ...c.ingresos].find((x) => x.rubroId === id);
      valores.push(l ? l.monto : null);
      colores.push(l && l.real !== null && l.real !== l.previsto ? COLORES.pendiente : null);
    }
    filas.push(valores);
    fondos.push(colores);
  };
  for (const [id, r] of rubros) if (r.tipo === "gasto") fila(id);
  const negritas: number[] = [];
  filas.push([]);
  negritas.push(filas.length);
  filas.push(["Total gastos", ...porMes.map((c) => c.totales.gastos)]);
  filas.push([]);
  for (const [id, r] of rubros) if (r.tipo === "ingreso") fila(id);
  if (porMes.some((c) => c.ingresos.length > 0)) {
    negritas.push(filas.length);
    filas.push(["Sobra", ...porMes.map((c) => c.totales.sobra)]);
  }
  filas.push([], [LEYENDA_CUENTAS]);
  return { titulo: PESTANAS.cuentas, columnas, filas, fondos, negritas, columnasFijas: 1, sinFiltro: true };
}

async function resumen(
  contratos: Contrato[],
  historiales: Map<string, PeriodoHistorial[]>,
  hoy: string,
): Promise<Pestana> {
  const desde = `${hoy.slice(0, 4)}-01-01`;
  const propiedades = (await propiedadesRepo.listarPropiedades()).sort((a, b) =>
    a.direccion.localeCompare(b.direccion),
  );
  const filas: Celda[][] = [];
  const totales = { ingresos: 0, gastos: 0, neto: 0, adeudados: 0 };
  for (const p of propiedades) {
    const vigente = contratos.find((c) => c.propiedadId === p.id && c.estado === "vigente");
    const balance = await calcularBalance({ propiedadId: p.id, desde, hasta: hoy });
    const adeudados = vigente
      ? (historiales.get(vigente.id) ?? []).filter((h) => h.estado !== "pagado" && h.fechaVencimiento < hoy).length
      : 0;
    totales.ingresos += balance.ingresos;
    totales.gastos += balance.gastos;
    totales.neto += balance.neto;
    totales.adeudados += adeudados;
    filas.push([
      p.direccion,
      p.propietario?.nombreCompleto ?? null,
      vigente ? "Alquilada" : "Libre",
      vigente?.inquilino.nombreCompleto ?? null,
      vigente ? Number(await valorVigente(vigente, hoy)) : null,
      balance.ingresos,
      balance.gastos,
      balance.neto,
      adeudados,
    ]);
  }
  const negritas: number[] = [];
  if (propiedades.length > 1) {
    negritas.push(filas.length);
    filas.push(["Total", null, null, null, null, totales.ingresos, totales.gastos, totales.neto, totales.adeudados]);
  }
  return {
    titulo: PESTANAS.resumen,
    columnas: [
      { titulo: "Propiedad" },
      { titulo: "Propietario" },
      { titulo: "Estado" },
      { titulo: "Inquilino" },
      { titulo: "Alquiler actual", tipo: "monto" },
      { titulo: `Cobrado ${hoy.slice(0, 4)}`, tipo: "monto" },
      { titulo: `Gastos ${hoy.slice(0, 4)}`, tipo: "monto" },
      { titulo: `Neto ${hoy.slice(0, 4)}`, tipo: "monto" },
      { titulo: "Meses adeudados" },
    ],
    filas,
    negritas,
  };
}

/** Todas las pestañas, en el orden en que aparecen en la planilla. */
export async function armarPlanilla(hoy = hoyISO()): Promise<Pestana[]> {
  const contratos = await contratosRepo.listarTodos();
  const historiales = new Map<string, PeriodoHistorial[]>();
  for (const c of contratos) historiales.set(c.id, await historialPagos(c));
  return [
    await resumen(contratos, historiales, hoy),
    await alquileres(contratos, historiales),
    await gastos(hoy),
    await personales(hoy),
    await cuentas(hoy),
  ];
}
