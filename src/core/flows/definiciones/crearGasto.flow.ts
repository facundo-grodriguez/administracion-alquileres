import { crearGastoTool } from "../../assistant/tools/crearGasto.tool.js";
import { formatoFechaAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { buscarPropiedadesParaFlujo } from "../entidadHelpers.js";
import { type DefinicionFlujo, etiquetaKey } from "../types.js";

export const TIPOS_GASTO = [
  { valor: "expensas", etiqueta: "Expensas" },
  { valor: "ABL", etiqueta: "ABL" },
  { valor: "ARBA", etiqueta: "ARBA" },
  { valor: "luz", etiqueta: "Luz" },
  { valor: "gas", etiqueta: "Gas" },
  { valor: "agua", etiqueta: "Agua" },
  { valor: "internet", etiqueta: "Internet" },
  { valor: "seguro_hogar", etiqueta: "Seguro hogar" },
  { valor: "reparacion", etiqueta: "🔧 Arreglo / reparación" },
  { valor: "otro", etiqueta: "Otro" },
];

const RESPONSABLES = [
  { valor: "propietario", etiqueta: "👤 Propietario" },
  { valor: "inquilino", etiqueta: "🏠 Inquilino" },
  { valor: "omitir", etiqueta: "Omitir" },
];

export const crearGastoFlow: DefinicionFlujo = {
  id: "crear_gasto",
  titulo: "💡 Gasto",
  etiqueta: (datos) => `${datos.tipo} — ${datos[etiquetaKey("propiedad_id")]}`,
  pasos: [
    {
      id: "propiedad_id",
      pregunta: () => "¿De qué propiedad es el gasto? Elegí una de la lista o escribí la dirección para buscar otra.",
      campo: {
        tipo: "entidad",
        buscar: buscarPropiedadesParaFlujo,
        crear: "crear_propiedad",
        etiquetaCrear: "➕ Crear propiedad",
      },
    },
    { id: "tipo", pregunta: () => "¿Qué tipo de gasto es?", campo: { tipo: "opciones", opciones: TIPOS_GASTO } },
    { id: "fecha_vencimiento", pregunta: () => "¿Fecha de vencimiento?", campo: { tipo: "fecha" } },
    {
      id: "responsable",
      pregunta: () => "¿Quién lo paga? (opcional)",
      campo: { tipo: "opciones", opciones: RESPONSABLES },
    },
    { id: "monto", pregunta: () => "¿Monto? (opcional)", campo: { tipo: "monto", opcional: true } },
    {
      id: "pagado",
      pregunta: () => "¿Ya está pagado? (si está pagado entra en el balance)",
      campo: {
        tipo: "opciones",
        opciones: [
          { valor: "si", etiqueta: "✅ Sí" },
          { valor: "no", etiqueta: "❌ Todavía no" },
        ],
      },
    },
    {
      id: "fecha_pago",
      pregunta: () => "¿Fecha de pago?",
      campo: { tipo: "fecha", permitirHoy: true },
      saltar: (datos) => datos.pagado !== "si",
    },
    {
      id: "__confirmar",
      pregunta: (datos) =>
        [
          "Confirmá el gasto:",
          "",
          `Propiedad: ${datos[etiquetaKey("propiedad_id")]}`,
          `Tipo: ${datos.tipo}`,
          `Vencimiento: ${formatoFechaAR(datos.fecha_vencimiento as string)}`,
          datos.responsable && datos.responsable !== "omitir" ? `Responsable de pago: ${datos.responsable}` : null,
          datos.monto ? `Monto: ${formatoARS(datos.monto as string)}` : null,
          datos.pagado === "si" ? `Pagado el ${formatoFechaAR(datos.fecha_pago as string)}` : "Pendiente de pago",
        ]
          .filter(Boolean)
          .join("\n"),
      campo: { tipo: "confirmacion" },
    },
  ],
  ejecutar: (datos) =>
    crearGastoTool.run({
      propiedad_id: datos.propiedad_id as string,
      tipo: datos.tipo as
        | "expensas"
        | "ABL"
        | "ARBA"
        | "luz"
        | "gas"
        | "agua"
        | "internet"
        | "seguro_hogar"
        | "reparacion"
        | "otro",
      fecha_vencimiento: datos.fecha_vencimiento as string,
      responsable:
        datos.responsable === "omitir" ? undefined : (datos.responsable as "propietario" | "inquilino" | undefined),
      monto: datos.monto as string | undefined,
      fecha_pago: datos.pagado === "si" ? (datos.fecha_pago as string) : undefined,
    }),
};
