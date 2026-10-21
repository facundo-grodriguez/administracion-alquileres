// Botones de acción que aparecen después de una carga o de un detalle ("💰 Registrar pago",
// "📄 Ver contrato", etc.). Se resuelven sin OpenAI: abren el flujo guiado que corresponde, con la
// propiedad o el contrato ya elegidos si el botón los trae, o muestran el dato directo. La única
// excepción es "⚡ IPC", que sigue pasando por el asistente (calcula con la API de IPC).
//
// callback_data: "accion:<nombre>" o "accion:<nombre>:c:<contratoId>" / "accion:<nombre>:p:<propiedadId>".
import { InlineKeyboard } from "grammy";
import { detalleContratoTexto } from "../../core/assistant/tools/consultarContrato.tool.js";
import type { DatosFlujo, FlowId, ReferenciaEntidad } from "../../core/flows/types.js";
import { etiquetaKey } from "../../core/flows/types.js";
import * as contratosRepo from "../../core/repositories/contratos.repository.js";
import * as gastosRepo from "../../core/repositories/gastosPropiedad.repository.js";
import * as propiedadesRepo from "../../core/repositories/propiedades.repository.js";
import { formatoFechaAR } from "../../core/util/fecha.js";
import { construirInlineKeyboard } from "./keyboards.js";

const PREFIJO = "accion:";

export type ResultadoAccion =
  | { tipo: "flujo"; flowId: FlowId; datos: DatosFlujo }
  | { tipo: "respuesta"; texto: string; teclado?: InlineKeyboard }
  | { tipo: "ia"; texto: string };

export function esCallbackAccion(datos: string): boolean {
  return datos.startsWith(PREFIJO);
}

export function parseCallbackAccion(datos: string): { accion: string; referencia: ReferenciaEntidad } {
  const [, accion, tipoId, id] = datos.split(":");
  const referencia: ReferenciaEntidad = {};
  if (tipoId === "c" && id) referencia.contratoId = id;
  if (tipoId === "p" && id) referencia.propiedadId = id;
  return { accion: accion ?? "", referencia };
}

type Contexto = {
  contrato?: NonNullable<Awaited<ReturnType<typeof contratosRepo.buscarContratoPorId>>>;
  propiedad?: Awaited<ReturnType<typeof propiedadesRepo.obtenerPropiedadPorId>>;
};

/** A partir del id que trae el botón, busca el contrato y la propiedad (uno lleva al otro). */
async function resolverContexto(ref: ReferenciaEntidad): Promise<Contexto> {
  if (ref.contratoId) {
    const contrato = await contratosRepo.buscarContratoPorId(ref.contratoId);
    return { contrato, propiedad: contrato?.propiedad };
  }
  if (ref.propiedadId) {
    const propiedad = await propiedadesRepo.obtenerPropiedadPorId(ref.propiedadId);
    const contrato = propiedad ? await contratosRepo.buscarContratoVigentePorPropiedad(propiedad.id) : undefined;
    return { contrato, propiedad };
  }
  return {};
}

function datosContrato(ctx: Contexto): DatosFlujo {
  if (!ctx.contrato) return {};
  return {
    contrato_id: ctx.contrato.id,
    [etiquetaKey("contrato_id")]: `${ctx.contrato.inquilino.nombreCompleto} — ${ctx.contrato.propiedad.direccion}`,
  };
}

function datosPropiedad(ctx: Contexto): DatosFlujo {
  if (!ctx.propiedad) return {};
  return { propiedad_id: ctx.propiedad.id, [etiquetaKey("propiedad_id")]: ctx.propiedad.direccion };
}

async function detallePropiedad(ctx: Contexto): Promise<ResultadoAccion> {
  if (!ctx.propiedad) {
    const propiedades = await propiedadesRepo.listarPropiedades();
    if (propiedades.length === 0) return { tipo: "respuesta", texto: "Todavía no hay propiedades cargadas." };
    const teclado = new InlineKeyboard();
    for (const p of propiedades) teclado.text(p.direccion, `${PREFIJO}ver_propiedad:p:${p.id}`).row();
    return { tipo: "respuesta", texto: "¿Qué propiedad?", teclado };
  }
  const p = ctx.propiedad;
  const conPropietario = await propiedadesRepo.obtenerConPropietario(p.id);
  const pendientes = (await gastosRepo.listarPendientes()).filter((g) => g.propiedadId === p.id);
  const texto = [
    `🏠 ${p.direccion}`,
    p.zona ? `Zona: ${p.zona}` : null,
    p.tipo ? `Tipo: ${p.tipo}` : null,
    conPropietario ? `Propietario: ${conPropietario.propietario.nombreCompleto}` : null,
    ctx.contrato
      ? `Contrato vigente: ${ctx.contrato.inquilino.nombreCompleto}, hasta ${formatoFechaAR(ctx.contrato.fechaFin)}`
      : "Sin contrato vigente",
    `Gastos sin pagar: ${pendientes.length}`,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    tipo: "respuesta",
    texto,
    teclado: construirInlineKeyboard("propiedad_detalle", { propiedadId: p.id, contratoId: ctx.contrato?.id }),
  };
}

async function detalleContrato(ctx: Contexto): Promise<ResultadoAccion> {
  if (!ctx.contrato) {
    const contratos = await contratosRepo.listarContratosVigentes();
    if (contratos.length === 0) return { tipo: "respuesta", texto: "No hay contratos vigentes." };
    const teclado = new InlineKeyboard();
    for (const c of contratos) {
      teclado
        .text(`${c.inquilino.nombreCompleto} — ${c.propiedad.direccion}`, `${PREFIJO}ver_contrato:c:${c.id}`)
        .row();
    }
    return { tipo: "respuesta", texto: "¿Qué contrato?", teclado };
  }
  return {
    tipo: "respuesta",
    texto: await detalleContratoTexto(ctx.contrato),
    teclado: construirInlineKeyboard("contrato_detalle", {
      contratoId: ctx.contrato.id,
      propiedadId: ctx.contrato.propiedadId,
    }),
  };
}

/** Resuelve un botón de acción. */
export async function resolverAccion(datos: string): Promise<ResultadoAccion | undefined> {
  const { accion, referencia } = parseCallbackAccion(datos);
  const ctx = await resolverContexto(referencia);

  switch (accion) {
    case "registrar_pago":
    case "otro_pago":
      return { tipo: "flujo", flowId: "crear_recibo", datos: datosContrato(ctx) };
    case "cargar_finaer":
      return { tipo: "flujo", flowId: "cargar_seguro_finaer", datos: datosContrato(ctx) };
    case "agregar_gasto":
    case "otro_gasto":
      return { tipo: "flujo", flowId: "crear_gasto", datos: datosPropiedad(ctx) };
    case "crear_contrato":
      return { tipo: "flujo", flowId: "crear_contrato", datos: datosPropiedad(ctx) };
    case "ver_contrato":
      return detalleContrato(ctx);
    case "ver_propiedad":
      return detallePropiedad(ctx);
    case "consultar_ipc": {
      // Única acción que pasa por la IA: el cálculo por IPC lo hace el asistente con la API externa.
      const c = ctx.contrato;
      return {
        tipo: "ia",
        texto: c
          ? `¿Corresponde actualizar el alquiler de ${c.inquilino.nombreCompleto} en ${c.propiedad.direccion}?`
          : "¿Corresponde actualizar el alquiler de ese contrato?",
      };
    }
    default:
      return undefined; // "vencimientos" lo resuelve Consultas (ver keyboards.ts)
  }
}
