// Flujos guiados de vencimientos de servicios (v9.8.0): agendar uno, marcarlo pagado y modificarlo.
// Como el resto de los flujos, al terminar llaman al run() de la tool — no repiten lógica.
import { crearVencimientoServicioTool } from "../../assistant/tools/crearVencimientoServicio.tool.js";
import { marcarServicioPagadoTool } from "../../assistant/tools/marcarServicioPagado.tool.js";
import { modificarVencimientoServicioTool } from "../../assistant/tools/modificarVencimientoServicio.tool.js";
import * as serviciosRepo from "../../repositories/serviciosVencimiento.repository.js";
import * as serviciosService from "../../services/serviciosVencimiento.service.js";
import { formatoFechaAR, formatoPeriodoAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { nombreServicio, SERVICIOS } from "../../util/vencimientoServicio.js";
import { buscarPropiedadesParaFlujo } from "../entidadHelpers.js";
import { type CandidatoFlujo, type DatosFlujo, type DefinicionFlujo, etiquetaKey } from "../types.js";

/** Nombre final del servicio: el elegido de la lista o el que se escribió en "Otro". */
const nombreElegido = (datos: DatosFlujo) =>
  datos.servicio === "otro" ? String(datos.nombre_otro ?? "").trim() : String(datos.servicio);

const OPCIONES_TERMINA = [
  { valor: "sin_fin", etiqueta: "🔁 Todos los meses" },
  { valor: "mes", etiqueta: "🔚 Termina en un mes (cuotas)" },
];

const PREGUNTA_HASTA = "¿Cuál es el último mes que vence? (MM/AAAA, ej. 12/2026)";

const OPCIONES_DEBITO = [
  { valor: "si", etiqueta: "🔄 Se debita solo (no me avises)" },
  { valor: "no", etiqueta: "🔔 Lo pago yo (avisame)" },
];

const OPCIONES_DE_AHORA = [
  { valor: "si", etiqueta: "✅ Sí, de ahora en más" },
  { valor: "no", etiqueta: "Solo ese mes" },
];

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
      id: "termina",
      pregunta: () => "¿Vence todos los meses o termina (por ejemplo, cuotas)?",
      campo: { tipo: "opciones", opciones: OPCIONES_TERMINA },
    },
    {
      id: "hasta",
      pregunta: () => PREGUNTA_HASTA,
      campo: { tipo: "periodo" },
      saltar: (datos) => datos.termina !== "mes",
    },
    { id: "debito", pregunta: () => "¿Cómo se paga?", campo: { tipo: "opciones", opciones: OPCIONES_DEBITO } },
    {
      id: "__confirmar",
      pregunta: (datos) =>
        [
          "Confirmá el vencimiento:",
          "",
          nombreServicio(nombreElegido(datos), datos[etiquetaKey("propiedad_id")] as string | undefined),
          `Vence el día ${datos.dia} de cada mes`,
          datos.monto ? `Monto aprox.: ${formatoARS(datos.monto as string)}` : null,
          datos.termina === "mes" ? `Última cuota: ${formatoPeriodoAR(datos.hasta as string)}` : null,
          "",
          datos.debito === "si"
            ? "🔄 Se debita solo: no te aviso; el día que vence lo marco pagado."
            : "Te aparece en la agenda de cada mañana hasta que lo marques como pagado.",
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
      hasta_periodo: datos.termina === "mes" ? (datos.hasta as string) : undefined,
      debito_automatico: datos.debito === "si",
    }),
};

/** "✏️ Fue otro monto" desde la agenda (v9.14.0): corrige lo debitado ese mes. */
export const corregirDebitoFlow: DefinicionFlujo = {
  id: "corregir_debito",
  titulo: "🔄 Débito",
  etiqueta: (datos) => datos[etiquetaKey("servicio_id")] as string,
  pasos: [
    {
      id: "monto",
      pregunta: (datos) => `¿Cuánto se debitó de ${datos[etiquetaKey("servicio_id")] ?? "ese servicio"}?`,
      campo: { tipo: "monto" },
    },
    {
      id: "de_ahora",
      pregunta: (datos) => `¿De ahora en más se debita ${formatoARS(datos.monto as string)}?`,
      campo: { tipo: "opciones", opciones: OPCIONES_DE_AHORA },
    },
    {
      id: "__confirmar",
      pregunta: (datos) =>
        `Confirmá: ${datos[etiquetaKey("servicio_id")]} de ${formatoPeriodoAR(datos.periodo as string)} — ${formatoARS(datos.monto as string)}${datos.de_ahora === "si" ? ", y de ahora en más ese monto" : ""}.`,
      campo: { tipo: "confirmacion" },
    },
  ],
  ejecutar: (datos) =>
    modificarVencimientoServicioTool.run({
      servicio_id: datos.servicio_id as string,
      accion: "monto_pagado",
      periodo: datos.periodo as string,
      monto: datos.monto as string,
      de_ahora_en_mas: datos.de_ahora === "si",
    }),
};

// El id de cada candidato a pagar lleva lo que los pasos siguientes necesitan saber sin ir a la base:
// "<servicioId>|<YYYY-MM>|<p si es de una propiedad>|<a si está alquilada>|<monto aprox.>".
const SEP = "|";

type VencimientoServicio = serviciosService.VencimientoServicio;

export async function idPagoServicio(v: VencimientoServicio): Promise<string> {
  const alquilada = await serviciosService.propiedadAlquilada(v.propiedadId);
  return [v.servicioId, v.periodo, v.propiedadId ? "p" : "", alquilada ? "a" : "", v.monto ?? ""].join(SEP);
}

export function etiquetaPagoServicio(v: VencimientoServicio): string {
  return `🕓 ${nombreServicio(v.nombre, v.propiedad)} — ${formatoFechaAR(v.fechaVencimiento)}${v.monto ? ` — ${formatoARS(v.monto)}` : ""}`;
}

/** En "✅ Pagar" (gastos y servicios juntos) el servicio elegido viene como "sv:<ref>". */
export const PREFIJO_PAGO_SERVICIO = "sv:";

/** La referencia del servicio a pagar: del flujo de servicios o de "✅ Pagar". */
function refPago(datos: DatosFlujo): string {
  if (datos.vencimiento !== undefined) return String(datos.vencimiento);
  const elegido = String(datos.gasto_id ?? "");
  return elegido.startsWith(PREFIJO_PAGO_SERVICIO) ? elegido.slice(PREFIJO_PAGO_SERVICIO.length) : "";
}

export const esPagoDeServicio = (datos: DatosFlujo) => refPago(datos) !== "";

export function infoPagoServicio(datos: DatosFlujo) {
  const [servicioId = "", periodo, propiedad, alquilada, monto] = refPago(datos).split(SEP);
  return {
    servicioId,
    periodo: periodo || undefined,
    esPropiedad: propiedad === "p",
    alquilada: alquilada === "a",
    montoAprox: monto || undefined,
  };
}

/** Monto final del pago: el aproximado si se confirmó, o el que se escribió. */
function montoPagado(datos: DatosFlujo): string | undefined {
  if (datos.usar_aprox === "si") return infoPagoServicio(datos).montoAprox;
  return (datos.monto_real ?? datos.monto ?? undefined) as string | undefined;
}

async function buscarParaPagar(query: string): Promise<CandidatoFlujo[]> {
  const items = await serviciosService.paraPagar();
  const candidatos = await Promise.all(
    items.map(async (v) => ({ id: await idPagoServicio(v), etiqueta: etiquetaPagoServicio(v) })),
  );
  return filtrar(candidatos, query);
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
      id: "usar_aprox",
      pregunta: (datos) => `¿Pagaste ${formatoARS(infoPagoServicio(datos).montoAprox!)}?`,
      campo: {
        tipo: "opciones",
        opciones: [
          { valor: "si", etiqueta: "✅ Sí, ese monto" },
          { valor: "no", etiqueta: "✏️ Otro monto" },
        ],
      },
      saltar: (datos) => !infoPagoServicio(datos).montoAprox,
    },
    {
      // Servicio personal: el monto es opcional (es solo para el registro).
      id: "monto",
      pregunta: () => "¿Cuánto pagaste? Si no lo sabés, tocá Omitir.",
      campo: { tipo: "monto", opcional: true },
      saltar: (datos) => infoPagoServicio(datos).esPropiedad || datos.usar_aprox === "si",
    },
    {
      // Servicio de una propiedad: se carga como gasto, así que hace falta el monto real.
      id: "monto_real",
      pregunta: () => "¿Cuánto pagaste? Escribí el monto (ej. 45000). Se carga como gasto de la propiedad.",
      campo: { tipo: "monto" },
      saltar: (datos) => !infoPagoServicio(datos).esPropiedad || datos.usar_aprox === "si",
    },
    {
      id: "responsable",
      pregunta: () => "La propiedad está alquilada: ¿quién lo pagó?",
      campo: {
        tipo: "opciones",
        opciones: [
          { valor: "propietario", etiqueta: "🏠 El propietario (resta del balance)" },
          { valor: "inquilino", etiqueta: "👤 El inquilino (no resta)" },
        ],
      },
      saltar: (datos) => !infoPagoServicio(datos).alquilada,
    },
    {
      id: "__confirmar",
      pregunta: (datos) => {
        const info = infoPagoServicio(datos);
        const monto = montoPagado(datos);
        return [
          "Confirmá el pago:",
          "",
          String(datos[etiquetaKey("vencimiento")] ?? datos[etiquetaKey("gasto_id")])
            .replace(/^🕓 /, "")
            .replace(/ — \$[^—]*$/, ""), // sin el monto aprox.
          `Pagado el ${formatoFechaAR(datos.fecha_pago as string)}`,
          monto ? `Monto: ${formatoARS(monto)}` : null,
          info.esPropiedad
            ? datos.responsable === "inquilino"
              ? "Se carga como gasto de la propiedad pagado por el inquilino (no resta del balance)."
              : "Se carga como gasto de la propiedad y resta del balance."
            : null,
        ]
          .filter((l) => l !== null)
          .join("\n");
      },
      campo: { tipo: "confirmacion" },
    },
  ],
  ejecutar: (datos) => {
    const info = infoPagoServicio(datos);
    return marcarServicioPagadoTool.run({
      servicio_id: info.servicioId,
      periodo: info.periodo,
      fecha_pago: datos.fecha_pago as string,
      monto: montoPagado(datos),
      responsable: datos.responsable as "propietario" | "inquilino" | undefined,
    });
  },
};

async function buscarServicios(query: string): Promise<CandidatoFlujo[]> {
  const servicios = await serviciosRepo.listarActivos();
  return filtrar(
    servicios.map((s) => ({
      id: s.id,
      etiqueta: `${nombreServicio(s.nombre, s.propiedad?.direccion)} — día ${s.diaVencimiento}${s.hastaPeriodo ? ` — hasta ${formatoPeriodoAR(s.hastaPeriodo)}` : ""}`,
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
          { valor: "fecha_pago", etiqueta: "🧾 La fecha en que lo pagué" },
          { valor: "monto_pagado", etiqueta: "💲 Cuánto pagué (último mes)" },
          { valor: "debito", etiqueta: "🔄 Se debita solo / lo pago yo" },
          { valor: "termina", etiqueta: "🔚 Cuándo termina (última cuota)" },
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
      id: "monto_pagado",
      pregunta: () => "¿Cuánto pagaste? (corrige el último mes pagado)",
      campo: { tipo: "monto" },
      saltar: (datos) => datos.accion !== "monto_pagado",
    },
    {
      id: "de_ahora",
      pregunta: (datos) => `¿De ahora en más es ${formatoARS(datos.monto_pagado as string)} por mes?`,
      campo: { tipo: "opciones", opciones: OPCIONES_DE_AHORA },
      saltar: (datos) => datos.accion !== "monto_pagado",
    },
    {
      id: "debito_valor",
      pregunta: () => "¿Cómo se paga?",
      campo: { tipo: "opciones", opciones: OPCIONES_DEBITO },
      saltar: (datos) => datos.accion !== "debito",
    },
    {
      id: "monto_debito",
      pregunta: () => "¿Cuánto se debita por mes? (Omitir deja el monto que tiene)",
      campo: { tipo: "monto", opcional: true },
      saltar: (datos) => datos.accion !== "debito" || datos.debito_valor !== "si",
    },
    {
      id: "fecha_pago",
      pregunta: () => "¿Qué día lo pagaste? (corrige el último mes pagado)",
      campo: { tipo: "fecha", permitirHoy: true },
      saltar: (datos) => datos.accion !== "fecha_pago",
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
      id: "termina",
      pregunta: () => "¿Hasta cuándo vence?",
      campo: {
        tipo: "opciones",
        opciones: [
          { valor: "mes", etiqueta: "🔚 Termina en un mes (última cuota)" },
          { valor: "sin_fin", etiqueta: "🔁 Todos los meses, sin fin" },
        ],
      },
      saltar: (datos) => datos.accion !== "termina",
    },
    {
      id: "hasta",
      pregunta: () => PREGUNTA_HASTA,
      campo: { tipo: "periodo" },
      saltar: (datos) => datos.accion !== "termina" || datos.termina !== "mes",
    },
    {
      id: "__confirmar",
      pregunta: (datos) => {
        const servicio = String(datos[etiquetaKey("servicio_id")]).replace(/ — día \d+.*$/, "");
        switch (datos.accion) {
          case "fecha_este_mes":
            return `Confirmá: ${servicio} vence el ${formatoFechaAR(datos.fecha as string)} solo esta vez. Los otros meses siguen igual.`;
          case "dia_fijo":
            return `Confirmá: ${servicio} pasa a vencer el día ${datos.dia} de cada mes.`;
          case "monto":
            return `Confirmá: ${servicio} — monto aprox. ${formatoARS(datos.monto as string)}.`;
          case "fecha_pago":
            return `Confirmá: el último pago de ${servicio} fue el ${formatoFechaAR(datos.fecha_pago as string)}.`;
          case "monto_pagado":
            return `Confirmá: el último pago de ${servicio} fue ${formatoARS(datos.monto_pagado as string)}${datos.de_ahora === "si" ? ", y de ahora en más es ese monto" : ""}.`;
          case "debito":
            return datos.debito_valor === "si"
              ? `Confirmá: ${servicio} se debita solo${datos.monto_debito ? ` (${formatoARS(datos.monto_debito as string)})` : ""}. No te aviso más; el día que vence lo marco pagado.`
              : `Confirmá: ${servicio} lo pagás vos. Te lo vuelvo a avisar en la agenda.`;
          case "termina":
            return datos.termina === "mes"
              ? `Confirmá: la última cuota de ${servicio} es ${formatoPeriodoAR(datos.hasta as string)}. Después no te aviso más y lo pagado queda en el seguimiento.`
              : `Confirmá: ${servicio} vence todos los meses, sin fecha de fin.`;
          default:
            return `Confirmá: dar de baja ${servicio}. No te aviso más, pero lo ya cargado queda en el seguimiento.\n\nSi son cuotas, mejor elegí "🔚 Cuándo termina": así te avisa hasta la última.`;
        }
      },
      campo: { tipo: "confirmacion" },
    },
  ],
  ejecutar: (datos) =>
    modificarVencimientoServicioTool.run({
      servicio_id: datos.servicio_id as string,
      accion: datos.accion as
        | "fecha_este_mes"
        | "dia_fijo"
        | "monto"
        | "termina"
        | "baja"
        | "fecha_pago"
        | "debito"
        | "monto_pagado",
      periodo: datos.periodo as string | undefined,
      fecha: (datos.accion === "fecha_pago" ? datos.fecha_pago : datos.fecha) as string | undefined,
      dia: datos.dia === undefined ? undefined : Number(datos.dia),
      monto: (datos.accion === "monto_pagado"
        ? datos.monto_pagado
        : datos.accion === "debito"
          ? datos.monto_debito
          : datos.monto) as string | undefined,
      debito_automatico: datos.accion === "debito" ? datos.debito_valor === "si" : undefined,
      de_ahora_en_mas: datos.accion === "monto_pagado" ? datos.de_ahora === "si" : undefined,
      hasta_periodo: datos.accion === "termina" && datos.termina === "mes" ? (datos.hasta as string) : undefined,
    }),
};
