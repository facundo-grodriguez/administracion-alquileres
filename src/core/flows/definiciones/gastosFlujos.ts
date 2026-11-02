// Flujos guiados para gastos ya cargados: marcarlos como pagados y corregirlos.
import * as gastosRepo from "../../repositories/gastosPropiedad.repository.js";
import * as gastosService from "../../services/gastosPropiedad.service.js";
import { formatoFechaAR, formatoPeriodoAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { entraEnBalance, hayQueElegirResponsable, type Responsable } from "../../util/responsableGasto.js";
import { buscarPropiedadesParaFlujo } from "../entidadHelpers.js";
import { type CandidatoFlujo, type DatosFlujo, type DefinicionFlujo, etiquetaKey } from "../types.js";
import { parsePeriodoUsuario } from "../validadores.js";
import { RESPONSABLES, TIPOS_GASTO } from "./crearGasto.flow.js";

const MANTENER = "mantener";
const etiquetaTipo = (valor: unknown) => TIPOS_GASTO.find((t) => t.valor === valor)?.etiqueta ?? String(valor);

type GastoConPropiedad = Awaited<ReturnType<typeof gastosRepo.listarRecientes>>[number];

function etiquetaGasto(g: GastoConPropiedad): string {
  const monto = g.monto ? ` — ${formatoARS(g.monto)}` : "";
  const estado = g.fechaPago ? "✅" : "🕓";
  return `${estado} ${g.tipo} — ${g.propiedad.direccion} — ${formatoFechaAR(g.fechaVencimiento)}${monto}`;
}

function filtrar(gastos: GastoConPropiedad[], query: string): CandidatoFlujo[] {
  const q = query.trim().toLowerCase();
  return gastos
    .filter((g) => !q || g.tipo.toLowerCase().includes(q) || g.propiedad.direccion.toLowerCase().includes(q))
    .map((g) => ({ id: g.id, etiqueta: etiquetaGasto(g) }));
}

/** Meses (YYYY-MM, del más nuevo al más viejo) que tienen gastos en la propiedad elegida. */
async function buscarMesesConGastos(query: string, datos: DatosFlujo): Promise<CandidatoFlujo[]> {
  const gastos = await gastosRepo.listarPorPropiedad(datos.propiedad_id as string);
  const porMes = new Map<string, number>();
  for (const g of gastos) {
    const mes = g.fechaVencimiento.slice(0, 7);
    porMes.set(mes, (porMes.get(mes) ?? 0) + 1);
  }
  const buscado = query.trim() ? parsePeriodoUsuario(query) : undefined;
  return [...porMes.entries()]
    .filter(([mes]) => !query.trim() || mes === buscado)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([mes, cantidad]) => ({
      id: mes,
      etiqueta: `${formatoPeriodoAR(mes)} (${cantidad} gasto${cantidad === 1 ? "" : "s"})`,
    }));
}

/** Gastos de la propiedad y el mes elegidos. */
async function buscarGastosDelMes(query: string, datos: DatosFlujo): Promise<CandidatoFlujo[]> {
  const gastos = (await gastosRepo.listarPorPropiedad(datos.propiedad_id as string)).filter(
    (g) => g.fechaVencimiento.slice(0, 7) === datos.mes,
  );
  const q = query.trim().toLowerCase();
  // La propiedad y el mes ya están elegidos: la etiqueta solo muestra tipo, fecha y monto.
  return gastos
    .filter((g) => !q || g.tipo.toLowerCase().includes(q))
    .map((g) => ({
      id: g.id,
      etiqueta: `${g.fechaPago ? "✅" : "🕓"} ${etiquetaTipo(g.tipo)} — ${formatoFechaAR(g.fechaVencimiento)}${g.monto ? ` — ${formatoARS(g.monto)}` : ""}`,
    }));
}

export const pagarGastoFlow: DefinicionFlujo = {
  id: "pagar_gasto",
  titulo: "✅ Pagar gasto",
  etiqueta: (datos) => datos[etiquetaKey("gasto_id")] as string,
  pasos: [
    {
      id: "gasto_id",
      pregunta: () => "¿Qué gasto se pagó? Elegí uno de la lista o escribí el tipo o la dirección para buscar.",
      campo: { tipo: "entidad", buscar: async (q) => filtrar(await gastosRepo.listarPendientes(), q) },
    },
    { id: "fecha_pago", pregunta: () => "¿Fecha de pago?", campo: { tipo: "fecha", permitirHoy: true } },
    {
      id: "monto",
      pregunta: () => "¿Cuánto se pagó? Si es el monto que ya estaba cargado, tocá Omitir.",
      campo: { tipo: "monto", opcional: true },
    },
    {
      id: "__confirmar",
      pregunta: (datos) =>
        [
          "Confirmá el pago del gasto:",
          "",
          `Gasto: ${datos[etiquetaKey("gasto_id")]}`,
          `Fecha de pago: ${formatoFechaAR(datos.fecha_pago as string)}`,
          datos.monto ? `Monto pagado: ${formatoARS(datos.monto as string)}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      campo: { tipo: "confirmacion" },
    },
  ],
  ejecutar: async (datos) => {
    const gasto = await gastosService.marcarPagado({
      gastoId: datos.gasto_id as string,
      fechaPago: datos.fecha_pago as string,
      monto: (datos.monto as string | undefined) || undefined,
    });
    if (!gasto) return "No encontré ese gasto.";
    return [
      "✅ Gasto marcado como pagado.",
      `Tipo: ${gasto.tipo}`,
      `Fecha de pago: ${formatoFechaAR(gasto.fechaPago!)}`,
      !entraEnBalance(gasto)
        ? `${gasto.monto ? `Monto: ${formatoARS(gasto.monto)} — ` : ""}lo paga el inquilino, no se descuenta del alquiler.`
        : gasto.monto
          ? `Monto: ${formatoARS(gasto.monto)} — ya figura en el balance.`
          : "No tiene monto cargado, así que no entra en el balance. Corregilo desde ✏️ Modificar → 💡 Gasto.",
    ].join("\n");
  },
  botonesPostAccion: "post_gasto",
};

export const corregirGastoFlow: DefinicionFlujo = {
  id: "corregir_gasto",
  titulo: "💡 Gasto",
  etiqueta: (datos) => datos[etiquetaKey("gasto_id")] as string,
  pasos: [
    {
      id: "propiedad_id",
      pregunta: () => "¿De qué propiedad es el gasto?",
      campo: { tipo: "entidad", buscar: buscarPropiedadesParaFlujo },
    },
    {
      id: "mes",
      pregunta: () => "¿De qué mes? (si es más viejo, escribilo: MM/AAAA)",
      campo: { tipo: "entidad", buscar: buscarMesesConGastos, maxListado: 12 },
    },
    {
      id: "gasto_id",
      pregunta: () => "¿Qué gasto querés corregir? (✅ pagado, 🕓 pendiente)",
      campo: { tipo: "entidad", buscar: buscarGastosDelMes, maxListado: 30 },
    },
    {
      id: "tipo",
      pregunta: () => "¿Cambiar el tipo de gasto? (ej. de Otro a Arreglo / reparación)",
      campo: { tipo: "opciones", opciones: [{ valor: MANTENER, etiqueta: "↩️ Dejarlo igual" }, ...TIPOS_GASTO] },
    },
    {
      id: "responsable",
      pregunta: () => "¿Quién lo paga? (lo del inquilino no se descuenta del alquiler)",
      campo: { tipo: "opciones", opciones: [{ valor: MANTENER, etiqueta: "↩️ Dejarlo igual" }, ...RESPONSABLES] },
      // Si lo pasó a un servicio, lo paga el inquilino: no hace falta preguntar.
      saltar: (d) => !!d.tipo && d.tipo !== MANTENER && !hayQueElegirResponsable(d.tipo),
    },
    {
      id: "monto",
      pregunta: () => "¿Monto correcto? Tocá Omitir para dejarlo como está.",
      campo: { tipo: "monto", opcional: true },
    },
    {
      id: "fecha_vencimiento",
      pregunta: () => "¿Fecha de vencimiento correcta? Tocá Omitir para dejarla como está.",
      campo: { tipo: "fecha", opcional: true },
    },
    {
      id: "fecha_pago",
      pregunta: () => "¿Fecha de pago? (cargala si ya se pagó; Omitir para dejarla como está)",
      campo: { tipo: "fecha", opcional: true, permitirHoy: true },
    },
    {
      id: "__confirmar",
      pregunta: (datos) =>
        [
          "Confirmá la corrección:",
          "",
          `Gasto: ${datos[etiquetaKey("gasto_id")]}`,
          datos.tipo && datos.tipo !== MANTENER ? `Tipo nuevo: ${etiquetaTipo(datos.tipo)}` : null,
          datos.responsable && datos.responsable !== MANTENER ? `Paga: ${datos.responsable}` : null,
          datos.monto ? `Monto nuevo: ${formatoARS(datos.monto as string)}` : null,
          datos.fecha_vencimiento ? `Vencimiento nuevo: ${formatoFechaAR(datos.fecha_vencimiento as string)}` : null,
          datos.fecha_pago ? `Fecha de pago: ${formatoFechaAR(datos.fecha_pago as string)}` : null,
          (!datos.tipo || datos.tipo === MANTENER) &&
          (!datos.responsable || datos.responsable === MANTENER) &&
          !datos.monto &&
          !datos.fecha_vencimiento &&
          !datos.fecha_pago
            ? "(no cambiaste nada)"
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      campo: { tipo: "confirmacion" },
    },
  ],
  ejecutar: async (datos) => {
    const resultado = await gastosService.corregir({
      gastoId: datos.gasto_id as string,
      tipo:
        datos.tipo && datos.tipo !== MANTENER
          ? (datos.tipo as Parameters<typeof gastosService.corregir>[0]["tipo"])
          : undefined,
      responsable: datos.responsable && datos.responsable !== MANTENER ? (datos.responsable as Responsable) : undefined,
      monto: (datos.monto as string | undefined) || undefined,
      fechaVencimiento: (datos.fecha_vencimiento as string | undefined) || undefined,
      fechaPago: (datos.fecha_pago as string | undefined) || undefined,
    });
    if (!resultado) return "No encontré ese gasto.";
    const { antes, despues } = resultado;
    const cambio = (nombre: string, a: string, b: string) => (a === b ? null : `${nombre}: ${a} → ${b}`);
    const cambios = [
      cambio("Tipo", etiquetaTipo(antes.tipo), etiquetaTipo(despues.tipo)),
      cambio("Paga", antes.responsable ?? "sin definir", despues.responsable ?? "sin definir"),
      cambio("Monto", formatoARS(antes.monto), formatoARS(despues.monto)),
      cambio("Vencimiento", formatoFechaAR(antes.fechaVencimiento), formatoFechaAR(despues.fechaVencimiento)),
      cambio(
        "Fecha de pago",
        antes.fechaPago ? formatoFechaAR(antes.fechaPago) : "sin pagar",
        despues.fechaPago ? formatoFechaAR(despues.fechaPago) : "sin pagar",
      ),
    ].filter(Boolean);
    return [
      cambios.length > 0 ? "✏️ Gasto corregido." : "No había nada para cambiar.",
      `${despues.tipo} — ${antes.propiedad.direccion}`,
      ...cambios,
      !entraEnBalance(despues)
        ? "Lo paga el inquilino: no se descuenta del alquiler."
        : despues.fechaPago && despues.monto
          ? "El balance ya refleja estos valores."
          : null,
    ]
      .filter(Boolean)
      .join("\n");
  },
};
