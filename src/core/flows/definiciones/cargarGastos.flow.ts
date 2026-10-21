// "🧾 Varios gastos": carga de una vez los gastos/servicios de una propiedad (expensas, luz, gas...),
// normalmente ya pagados. Cada gasto queda como un registro independiente — es lo mismo que cargarlos
// uno por uno con "💡 Gasto", pero sin repetir la propiedad ni la fecha de pago, y sin tener que
// pasar después por "✅ Pagar gasto".
import { crearGastoTool } from "../../assistant/tools/crearGasto.tool.js";
import { formatoFechaAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { buscarPropiedadesParaFlujo } from "../entidadHelpers.js";
import { type DatosFlujo, type DefinicionFlujo, etiquetaKey, type PasoFlujo } from "../types.js";
import { TIPOS_GASTO } from "./crearGasto.flow.js";

export const MAX_GASTOS_POR_CARGA = 8;
const FIN = "fin";

type TipoGasto = Parameters<typeof crearGastoTool.run>[0]["tipo"];

const etiquetaTipo = (valor: unknown) => TIPOS_GASTO.find((t) => t.valor === valor)?.etiqueta ?? String(valor);

/** El gasto n está en la carga si el usuario eligió un tipo (y no "No hay más") en todos los anteriores. */
function gastoActivo(datos: DatosFlujo, n: number): boolean {
  for (let i = 1; i < n; i++) {
    const tipo = datos[`gasto${i}_tipo`];
    if (tipo === undefined || tipo === FIN) return false;
  }
  return true;
}

export type GastoCargado = { tipo: TipoGasto; monto?: string; vencimiento?: string };

export function gastosCargados(datos: DatosFlujo): GastoCargado[] {
  const gastos: GastoCargado[] = [];
  for (let n = 1; n <= MAX_GASTOS_POR_CARGA; n++) {
    const tipo = datos[`gasto${n}_tipo`];
    if (tipo === undefined || tipo === FIN) break;
    gastos.push({
      tipo: tipo as TipoGasto,
      monto: datos[`gasto${n}_monto`] as string | undefined,
      vencimiento: datos[`gasto${n}_vencimiento`] as string | undefined,
    });
  }
  return gastos;
}

/**
 * Pasos para cargar hasta MAX_GASTOS_POR_CARGA gastos seguidos (tipo → monto → vencimiento, y
 * "¿Otro gasto?"). Los usa "🧾 Varios gastos" y también "💰 Pago" (servicios pagados junto con el
 * alquiler). `incluir` decide si se pregunta por gastos; `pedirVencimiento`, si hace falta la fecha
 * de vencimiento (para gastos ya pagados no: queda la de pago).
 */
export function pasosGastos(opciones: {
  incluir: (d: DatosFlujo) => boolean;
  pedirVencimiento: (d: DatosFlujo) => boolean;
  primeraPregunta?: string;
}): PasoFlujo[] {
  return Array.from({ length: MAX_GASTOS_POR_CARGA }, (_, i) => i + 1).flatMap((n): PasoFlujo[] => {
    const tiposOpciones = n === 1 ? TIPOS_GASTO : [{ valor: FIN, etiqueta: "✅ No hay más" }, ...TIPOS_GASTO];
    const enCarga = (d: DatosFlujo) => opciones.incluir(d) && gastoActivo(d, n);
    const activo = (d: DatosFlujo) => enCarga(d) && d[`gasto${n}_tipo`] !== FIN;
    return [
      {
        id: `gasto${n}_tipo`,
        pregunta: () => (n === 1 ? (opciones.primeraPregunta ?? "¿Qué gasto es?") : `¿Otro gasto? (van ${n - 1})`),
        campo: { tipo: "opciones", opciones: tiposOpciones },
        saltar: (d) => !enCarga(d),
      },
      {
        id: `gasto${n}_monto`,
        pregunta: (d) => `¿Monto de ${etiquetaTipo(d[`gasto${n}_tipo`])}?`,
        campo: { tipo: "monto" },
        saltar: (d) => !activo(d),
      },
      {
        id: `gasto${n}_vencimiento`,
        pregunta: (d) => `¿Vencimiento de ${etiquetaTipo(d[`gasto${n}_tipo`])}?`,
        campo: { tipo: "fecha" },
        saltar: (d) => !activo(d) || !opciones.pedirVencimiento(d),
      },
    ];
  });
}

export function resumenGastos(gastos: GastoCargado[]): string[] {
  const total = gastos.reduce((acc, g) => acc + Number(g.monto ?? 0), 0);
  return [
    ...gastos.map(
      (g) =>
        `• ${etiquetaTipo(g.tipo)}: ${formatoARS(g.monto)}${g.vencimiento ? ` (vence ${formatoFechaAR(g.vencimiento)})` : ""}`,
    ),
    `Total gastos: ${formatoARS(total)}`,
  ];
}

/** Crea cada gasto como registro independiente (pagado si viene fechaPago). Devuelve el total. */
export async function crearGastos(
  propiedadId: string,
  gastos: GastoCargado[],
  opciones: { fechaPago?: string; responsable?: "propietario" | "inquilino" },
): Promise<number> {
  for (const g of gastos) {
    await crearGastoTool.run({
      propiedad_id: propiedadId,
      tipo: g.tipo,
      fecha_vencimiento: (opciones.fechaPago ?? g.vencimiento) as string,
      responsable: opciones.responsable,
      monto: g.monto,
      fecha_pago: opciones.fechaPago,
    });
  }
  return gastos.reduce((acc, g) => acc + Number(g.monto ?? 0), 0);
}

export const cargarGastosFlow: DefinicionFlujo = {
  id: "cargar_gastos",
  titulo: "🧾 Varios gastos",
  etiqueta: (datos) => datos[etiquetaKey("propiedad_id")] as string,
  pasos: [
    {
      id: "propiedad_id",
      pregunta: () => "¿De qué propiedad son los gastos?",
      campo: { tipo: "entidad", buscar: buscarPropiedadesParaFlujo },
    },
    {
      id: "pagados",
      pregunta: () => "¿Ya están pagados?",
      campo: {
        tipo: "opciones",
        opciones: [
          { valor: "si", etiqueta: "✅ Sí, todos pagos" },
          { valor: "no", etiqueta: "🕓 Todavía no" },
        ],
      },
    },
    {
      id: "fecha_pago",
      pregunta: () => "¿Fecha de pago?",
      campo: { tipo: "fecha", permitirHoy: true },
      saltar: (d) => d.pagados !== "si",
    },
    {
      id: "responsable",
      pregunta: () => "¿Quién los paga? (opcional)",
      campo: {
        tipo: "opciones",
        opciones: [
          { valor: "propietario", etiqueta: "👤 Propietario" },
          { valor: "inquilino", etiqueta: "🏠 Inquilino" },
          { valor: "omitir", etiqueta: "Omitir" },
        ],
      },
    },
    ...pasosGastos({ incluir: () => true, pedirVencimiento: (d) => d.pagados !== "si" }),
    {
      id: "__confirmar",
      pregunta: (datos) =>
        [
          `Confirmá ${gastosCargados(datos).length} gasto(s) de ${datos[etiquetaKey("propiedad_id")]}:`,
          "",
          ...resumenGastos(gastosCargados(datos)),
          datos.pagados === "si"
            ? `✅ Pagados el ${formatoFechaAR(datos.fecha_pago as string)}`
            : "🕓 Pendientes de pago",
        ].join("\n"),
      campo: { tipo: "confirmacion" },
    },
  ],
  ejecutar: async (datos) => {
    const gastos = gastosCargados(datos);
    const pagados = datos.pagados === "si";
    const total = await crearGastos(datos.propiedad_id as string, gastos, {
      fechaPago: pagados ? (datos.fecha_pago as string) : undefined,
      responsable:
        datos.responsable === "omitir" ? undefined : (datos.responsable as "propietario" | "inquilino" | undefined),
    });
    return [
      `✅ Cargué ${gastos.length} gasto(s) de ${datos[etiquetaKey("propiedad_id")]} por ${formatoARS(total)}.`,
      pagados
        ? "Quedaron pagados y ya figuran en el balance."
        : "Quedaron pendientes: entran al balance cuando los pagues.",
    ].join("\n");
  },
  botonesPostAccion: "post_gasto",
};
