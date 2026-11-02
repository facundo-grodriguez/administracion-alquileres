// Flujos guiados de vencimientos de servicios (v9.8.0): agendar uno, marcarlo pagado y modificarlo.
// Como el resto de los flujos, al terminar llaman al run() de la tool — no repiten lógica.
import { crearVencimientoServicioTool } from "../../assistant/tools/crearVencimientoServicio.tool.js";
import { marcarServicioPagadoTool } from "../../assistant/tools/marcarServicioPagado.tool.js";
import { modificarVencimientoServicioTool } from "../../assistant/tools/modificarVencimientoServicio.tool.js";
import * as serviciosRepo from "../../repositories/serviciosVencimiento.repository.js";
import * as serviciosService from "../../services/serviciosVencimiento.service.js";
import { formatoFechaAR, formatoPeriodoAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { DIAS_AVISO_PREVIO, nombreServicio, SERVICIOS } from "../../util/vencimientoServicio.js";
import { buscarPropiedadesParaFlujo } from "../entidadHelpers.js";
import { type CandidatoFlujo, type DatosFlujo, type DefinicionFlujo, etiquetaKey } from "../types.js";

/** Nombre final del servicio: el elegido de la lista o el que se escribió en "Otro". */
const nombreElegido = (datos: DatosFlujo) =>
  datos.servicio === "otro" ? String(datos.nombre_otro ?? "").trim() : String(datos.servicio);

const filtrar = <T extends { etiqueta: string }>(items: T[], query: string) => {
  const q = query.trim().toLowerCase();
  return items.filter((c) => !q || c.etiqueta.toLowerCase().includes(q));
};

export const crearVencimientoServicioFlow: DefinicionFlujo = {
  id: "crear_vencimiento_servicio",
  titulo: "📅 Vencimiento",
  etiqueta: (datos) => nombreServicio(nombreElegido(datos), datos[etiquetaKey("propiedad_id")] as string | undefined),
  pasos: [
    {
      id: "de_quien",
      pregunta: () => "¿Es un servicio tuyo o de una propiedad?",
      campo: {
        tipo: "opciones",
        opciones: [
          { valor: "personal", etiqueta: "👤 Personal" },
          { valor: "propiedad", etiqueta: "🏠 De una propiedad" },
        ],
      },
      saltar: (datos) => datos.propiedad_id !== undefined,
    },
    {
      id: "propiedad_id",
      pregunta: () => "¿De qué propiedad? Elegí una de la lista o escribí la dirección para buscar.",
      campo: { tipo: "entidad", buscar: buscarPropiedadesParaFlujo },
      saltar: (datos) => datos.de_quien !== "propiedad",
    },
    { id: "servicio", pregunta: () => "¿Qué servicio?", campo: { tipo: "opciones", opciones: SERVICIOS } },
    {
      id: "nombre_otro",
      pregunta: () => "¿Cómo se llama? (ej. Tarjeta Visa, Gimnasio, Patente)",
      campo: { tipo: "texto" },
      saltar: (datos) => datos.servicio !== "otro",
    },
    {
      id: "dia",
      pregunta: () => "¿Qué día del mes vence? Escribí el número (ej. 15).",
      campo: { tipo: "numero", min: 1, max: 31 },
    },
    {
      id: "monto",
      pregunta: () => "¿Cuánto es, más o menos? (opcional)",
      campo: { tipo: "monto", opcional: true },
    },
    {
      id: "__confirmar",
      pregunta: (datos) =>
        [
          "Confirmá el vencimiento:",
          "",
          nombreServicio(nombreElegido(datos), datos[etiquetaKey("propiedad_id")] as string | undefined),
          `Vence el día ${datos.dia} de cada mes`,
          datos.monto ? `Monto aprox.: ${formatoARS(datos.monto as string)}` : null,
          "",
          `Te aviso ${DIAS_AVISO_PREVIO} días antes y el mismo día, hasta que lo marques como pagado.`,
        ]
          .filter((l) => l !== null)
          .join("\n"),
      campo: { tipo: "confirmacion" },
    },
  ],
  ejecutar: (datos) =>
    crearVencimientoServicioTool.run({
      nombre: nombreElegido(datos),
      dia_vencimiento: Number(datos.dia),
      propiedad_id: datos.de_quien === "propiedad" || datos.propiedad_id ? (datos.propiedad_id as string) : undefined,
      monto: datos.monto as string | undefined,
    }),
};

// El id de cada candidato a pagar lleva el servicio y el mes: "<servicioId>|<YYYY-MM>".
const SEP = "|";

async function buscarParaPagar(query: string): Promise<CandidatoFlujo[]> {
  const items = await serviciosService.paraPagar();
  return filtrar(
    items.map((v) => ({
      id: `${v.servicioId}${SEP}${v.periodo}`,
      etiqueta: `🕓 ${nombreServicio(v.nombre, v.propiedad)} — ${formatoFechaAR(v.fechaVencimiento)}${v.monto ? ` — ${formatoARS(v.monto)}` : ""}`,
    })),
    query,
  );
}

export const pagarServicioFlow: DefinicionFlujo = {
  id: "pagar_servicio",
  titulo: "✅ Pagar servicio",
  etiqueta: (datos) => datos[etiquetaKey("vencimiento")] as string,
  pasos: [
    {
      id: "vencimiento",
      pregunta: () => "¿Qué servicio pagaste?",
      campo: { tipo: "entidad", buscar: buscarParaPagar },
    },
    { id: "fecha_pago", pregunta: () => "¿Cuándo lo pagaste?", campo: { tipo: "fecha", permitirHoy: true } },
    {
      id: "monto",
      pregunta: () => "¿Cuánto pagaste? Si es lo de siempre, tocá Omitir.",
      campo: { tipo: "monto", opcional: true },
    },
    {
      id: "__confirmar",
      pregunta: (datos) =>
        [
          "Confirmá el pago:",
          "",
          String(datos[etiquetaKey("vencimiento")]).replace(/^🕓 /, ""),
          `Pagado el ${formatoFechaAR(datos.fecha_pago as string)}`,
          datos.monto ? `Monto: ${formatoARS(datos.monto as string)}` : null,
        ]
          .filter((l) => l !== null)
          .join("\n"),
      campo: { tipo: "confirmacion" },
    },
  ],
  ejecutar: (datos) => {
    const [servicioId, periodo] = String(datos.vencimiento).split(SEP);
    return marcarServicioPagadoTool.run({
      servicio_id: servicioId!,
      periodo,
      fecha_pago: datos.fecha_pago as string,
      monto: datos.monto as string | undefined,
    });
  },
};

async function buscarServicios(query: string): Promise<CandidatoFlujo[]> {
  const servicios = await serviciosRepo.listarActivos();
  return filtrar(
    servicios.map((s) => ({
      id: s.id,
      etiqueta: `${nombreServicio(s.nombre, s.propiedad?.direccion)} — día ${s.diaVencimiento}`,
    })),
    query,
  );
}

export const editarVencimientoServicioFlow: DefinicionFlujo = {
  id: "editar_vencimiento_servicio",
  titulo: "📅 Vencimiento de servicio",
  etiqueta: (datos) => datos[etiquetaKey("servicio_id")] as string,
  pasos: [
    {
      id: "servicio_id",
      pregunta: () => "¿Qué vencimiento querés cambiar?",
      campo: { tipo: "entidad", buscar: buscarServicios },
    },
    {
      id: "accion",
      pregunta: () => "¿Qué querés cambiar?",
      campo: {
        tipo: "opciones",
        opciones: [
          { valor: "fecha_este_mes", etiqueta: "📅 La fecha de este mes" },
          { valor: "dia_fijo", etiqueta: "🔁 El día de todos los meses" },
          { valor: "monto", etiqueta: "💲 El monto" },
          { valor: "baja", etiqueta: "🗑️ Dar de baja" },
        ],
      },
    },
    {
      id: "fecha",
      pregunta: (datos) =>
        `¿Qué fecha trae la factura${datos.periodo ? ` de ${formatoPeriodoAR(datos.periodo as string)}` : ""}? (DD/MM/AAAA)`,
      campo: { tipo: "fecha" },
      saltar: (datos) => datos.accion !== "fecha_este_mes",
    },
    {
      id: "dia",
      pregunta: () => "¿Qué día del mes vence ahora? Escribí el número (ej. 20).",
      campo: { tipo: "numero", min: 1, max: 31 },
      saltar: (datos) => datos.accion !== "dia_fijo",
    },
    {
      id: "monto",
      pregunta: () => "¿Cuál es el monto aproximado?",
      campo: { tipo: "monto" },
      saltar: (datos) => datos.accion !== "monto",
    },
    {
      id: "__confirmar",
      pregunta: (datos) => {
        const servicio = String(datos[etiquetaKey("servicio_id")]).replace(/ — día \d+$/, "");
        switch (datos.accion) {
          case "fecha_este_mes":
            return `Confirmá: ${servicio} vence el ${formatoFechaAR(datos.fecha as string)} solo esta vez. Los otros meses siguen igual.`;
          case "dia_fijo":
            return `Confirmá: ${servicio} pasa a vencer el día ${datos.dia} de cada mes.`;
          case "monto":
            return `Confirmá: ${servicio} — monto aprox. ${formatoARS(datos.monto as string)}.`;
          default:
            return `Confirmá: dar de baja ${servicio}. No te aviso más.`;
        }
      },
      campo: { tipo: "confirmacion" },
    },
  ],
  ejecutar: (datos) =>
    modificarVencimientoServicioTool.run({
      servicio_id: datos.servicio_id as string,
      accion: datos.accion as "fecha_este_mes" | "dia_fijo" | "monto" | "baja",
      periodo: datos.periodo as string | undefined,
      fecha: datos.fecha as string | undefined,
      dia: datos.dia === undefined ? undefined : Number(datos.dia),
      monto: datos.monto as string | undefined,
    }),
};
