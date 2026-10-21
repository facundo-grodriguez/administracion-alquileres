import { crearReciboTool } from "../../assistant/tools/crearRecibo.tool.js";
import * as contratosRepo from "../../repositories/contratos.repository.js";
import { formatoARS } from "../../util/formato.js";
import { buscarContratosVigentesParaFlujo } from "../entidadHelpers.js";
import { type DefinicionFlujo, etiquetaKey } from "../types.js";
import { crearGastos, gastosCargados, pasosGastos, resumenGastos } from "./cargarGastos.flow.js";

const MEDIOS_PAGO = [
  { valor: "transferencia", etiqueta: "Transferencia" },
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "ambos", etiqueta: "Efectivo + transferencia" },
  { valor: "omitir", etiqueta: "Omitir" },
];

/** Texto del medio de pago tal como queda guardado (ej. "efectivo $ 200.000 + transferencia $ 250.000"). */
export function medioPagoTexto(datos: Record<string, unknown>): string | undefined {
  if (datos.medio_pago === "omitir" || datos.medio_pago === undefined) return undefined;
  if (datos.medio_pago !== "ambos") return datos.medio_pago as string;
  const efectivo = Number(datos.monto_efectivo);
  const transferencia = Number(datos.monto) - efectivo;
  return `efectivo ${formatoARS(efectivo)} + transferencia ${formatoARS(transferencia)}`;
}

export const crearReciboFlow: DefinicionFlujo = {
  id: "crear_recibo",
  titulo: "💰 Pago",
  etiqueta: (datos) => datos[etiquetaKey("contrato_id")] as string,
  pasos: [
    {
      id: "contrato_id",
      pregunta: () =>
        "¿De qué contrato es el pago? Escribí el nombre del inquilino o la dirección. " +
        "(Si el mes ya estaba cargado, se corrige con los datos nuevos.)",
      campo: { tipo: "entidad", buscar: buscarContratosVigentesParaFlujo },
    },
    { id: "periodo", pregunta: () => "¿Qué período paga? (MM/AAAA)", campo: { tipo: "periodo" } },
    { id: "monto", pregunta: () => "¿Cuánto pagó?", campo: { tipo: "monto" } },
    { id: "fecha_pago", pregunta: () => "¿Fecha de pago?", campo: { tipo: "fecha", permitirHoy: true } },
    {
      id: "medio_pago",
      pregunta: () => "¿Medio de pago? (opcional)",
      campo: { tipo: "opciones", opciones: MEDIOS_PAGO },
    },
    {
      id: "monto_efectivo",
      pregunta: (datos) =>
        `¿Cuánto fue en efectivo? El resto de ${formatoARS(datos.monto as string)} queda como transferencia.`,
      campo: { tipo: "monto" },
      saltar: (datos) => datos.medio_pago !== "ambos",
      validar: async (datos) =>
        Number(datos.monto_efectivo) >= Number(datos.monto)
          ? { mensaje: `⚠️ El efectivo tiene que ser menor que el total (${formatoARS(datos.monto as string)}).` }
          : undefined,
    },
    {
      id: "con_servicios",
      pregunta: () => "¿Pagó también servicios o gastos de la propiedad (luz, gas, expensas...)?",
      campo: {
        tipo: "opciones",
        opciones: [
          { valor: "si", etiqueta: "✅ Sí, cargarlos" },
          { valor: "no", etiqueta: "❌ No" },
        ],
      },
    },
    // Los servicios quedan pagados con la misma fecha que el alquiler: no hace falta el vencimiento.
    ...pasosGastos({
      incluir: (d) => d.con_servicios === "si",
      pedirVencimiento: () => false,
      primeraPregunta: "¿Qué servicio pagó?",
    }),
    {
      id: "__confirmar",
      pregunta: (datos) =>
        [
          "Confirmá el pago:",
          "",
          `Contrato: ${datos[etiquetaKey("contrato_id")]}`,
          `Período: ${datos.periodo}`,
          `Importe: ${formatoARS(datos.monto as string)}`,
          medioPagoTexto(datos) ? `Medio de pago: ${medioPagoTexto(datos)}` : null,
          ...(gastosCargados(datos).length > 0
            ? ["", "Servicios pagados:", ...resumenGastos(gastosCargados(datos))]
            : []),
        ]
          .filter(Boolean)
          .join("\n"),
      campo: { tipo: "confirmacion" },
    },
  ],
  ejecutar: async (datos) => {
    const textoPago = await crearReciboTool.run({
      contrato_id: datos.contrato_id as string,
      periodo: datos.periodo as string,
      monto: datos.monto as string,
      fecha_pago: datos.fecha_pago as string,
      medio_pago: medioPagoTexto(datos),
    });
    const gastos = gastosCargados(datos);
    if (gastos.length === 0) return textoPago;

    const contrato = await contratosRepo.buscarContratoPorId(datos.contrato_id as string);
    if (!contrato) return textoPago;
    const total = await crearGastos(contrato.propiedadId, gastos, { fechaPago: datos.fecha_pago as string });
    return `${textoPago}\n\n✅ Además cargué ${gastos.length} servicio(s) pagado(s) por ${formatoARS(total)}.`;
  },
};
