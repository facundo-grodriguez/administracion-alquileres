// Arma el contenido de la planilla de Google (v9.10.0) a partir de la base: una pestaña por tema.
// No sabe nada de Google: devuelve tablas (títulos, columnas y filas) que después se escriben tal cual.
import * as contratosRepo from "../repositories/contratos.repository.js";
import * as gastosRepo from "../repositories/gastosPropiedad.repository.js";
import * as propiedadesRepo from "../repositories/propiedades.repository.js";
import { valorVigente } from "../services/actualizacionAlquiler.service.js";
import { calcularBalance } from "../services/movimientos.service.js";
import { historialPagos, type PeriodoHistorial } from "../services/pagos.service.js";
import * as serviciosService from "../services/serviciosVencimiento.service.js";
import { hoyISO } from "../util/fecha.js";
import { entraEnBalance } from "../util/responsableGasto.js";

/** Texto, número o fecha ISO (YYYY-MM-DD); null = celda vacía. */
export type Celda = string | number | null;
export type TipoColumna = "texto" | "fecha" | "mes" | "monto";
export type Columna = { titulo: string; tipo?: TipoColumna };
export type Pestana = { titulo: string; columnas: Columna[]; filas: Celda[][] };

export const PESTANAS = {
  resumen: "Resumen",
  alquileres: "Alquileres",
  gastos: "Gastos propiedades",
  personales: "Servicios personales",
} as const;

const RUBROS: Record<string, string> = {
  expensas: "Expensas",
  ABL: "ABL",
  ARBA: "ARBA",
  luz: "Luz",
  gas: "Gas",
  agua: "Agua",
  internet: "Internet",
  seguro_hogar: "Seguro hogar",
  seguro_incendio: "Seguro incendio",
  reparacion: "Arreglo",
  otro: "Otro",
};

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

async function gastos(): Promise<Pestana> {
  const todos = await gastosRepo.listarTodos();
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
    filas: todos.map((g) => [
      g.fechaVencimiento,
      g.propiedad.direccion,
      RUBROS[g.tipo] ?? g.tipo,
      g.observaciones,
      g.responsable === "inquilino" ? "Inquilino" : g.responsable === "propietario" ? "Propietario" : null,
      num(g.monto),
      g.fechaPago ? "Pagado" : "Pendiente",
      g.fechaPago,
      entraEnBalance(g) ? "Sí" : "No",
    ]),
  };
}

async function personales(hoy: string): Promise<Pestana> {
  const items = (await serviciosService.historialPersonales(hoy)).sort(
    (a, b) => b.periodo.localeCompare(a.periodo) || a.fechaVencimiento.localeCompare(b.fechaVencimiento),
  );
  return {
    titulo: PESTANAS.personales,
    columnas: [
      { titulo: "Mes", tipo: "mes" },
      { titulo: "Servicio" },
      { titulo: "Vence", tipo: "fecha" },
      { titulo: "Monto", tipo: "monto" },
      { titulo: "Estado" },
      { titulo: "Pagado el", tipo: "fecha" },
    ],
    filas: items.map((v) => [
      primeroDeMes(v.periodo),
      v.nombre,
      v.fechaVencimiento,
      num(v.monto),
      v.fechaPago ? "Pagado" : v.fechaVencimiento < hoy ? "Vencido" : "Pendiente",
      v.fechaPago,
    ]),
  };
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
  if (propiedades.length > 1)
    filas.push(["Total", null, null, null, null, totales.ingresos, totales.gastos, totales.neto, totales.adeudados]);
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
    await gastos(),
    await personales(hoy),
  ];
}
