// Menú "🔎 Consultas": junta en un solo lugar todo lo que se puede consultar, con botones, y lo
// resuelve directo contra el backend — sin pasar por OpenAI. Callback_data: "cq:<op>" para las
// consultas generales y "cq:<op>:<contratoId>" para las de un contrato puntual.
import { InlineKeyboard } from "grammy";
import { detalleContratoTexto } from "../../core/assistant/tools/consultarContrato.tool.js";
import { historialPagosTexto } from "../../core/assistant/tools/historialPagos.tool.js";
import * as contratosRepo from "../../core/repositories/contratos.repository.js";
import * as gastosRepo from "../../core/repositories/gastosPropiedad.repository.js";
import * as movimientosService from "../../core/services/movimientos.service.js";
import * as pagosService from "../../core/services/pagos.service.js";
import * as vencimientosService from "../../core/services/vencimientos.service.js";
import { diasEntreISO, formatoFechaAR, formatoPeriodoAR, hoyISO, sumarDiasISO } from "../../core/util/fecha.js";
import { formatoARS } from "../../core/util/formato.js";
import { tecladoAlquilerActual } from "./flowKeyboards.js";
import { cobrosDelMesTexto } from "./menuDirecto.js";

const PREFIJO = "cq:";

type OpcionConsulta = { op: string; texto: string; porContrato?: boolean };

export const OPCIONES_CONSULTA: OpcionConsulta[] = [
  { op: "cobros", texto: "💰 Cobros del mes" },
  { op: "deudas", texto: "⚠️ Meses sin pago" },
  { op: "hist", texto: "🧾 Historial de pagos", porContrato: true },
  { op: "det", texto: "📄 Ver un contrato", porContrato: true },
  { op: "venc", texto: "📆 Vencimientos (30 días)" },
  { op: "ipc", texto: "⚡ Actualizaciones de alquiler" },
  { op: "gastos", texto: "💡 Gastos sin pagar" },
  { op: "gar", texto: "🛡️ Garantes", porContrato: true },
  { op: "balmes", texto: "💵 Balance del mes" },
  { op: "balanio", texto: "💵 Balance del año" },
];

export type RespuestaConsulta = { texto: string; teclado?: InlineKeyboard };

export function esCallbackConsulta(datos: string): boolean {
  return datos.startsWith(PREFIJO);
}

export function parseCallbackConsulta(datos: string): { op: string; contratoId?: string } {
  const [, op, contratoId] = datos.split(":");
  return { op: op ?? "", contratoId };
}

export function tecladoConsultas(): InlineKeyboard {
  const teclado = new InlineKeyboard();
  for (let i = 0; i < OPCIONES_CONSULTA.length; i += 2) {
    for (const o of OPCIONES_CONSULTA.slice(i, i + 2)) teclado.text(o.texto, `${PREFIJO}${o.op}`);
    teclado.row();
  }
  return teclado;
}

const botonOtraConsulta = (teclado = new InlineKeyboard()) => teclado.row().text("🔎 Otra consulta", `${PREFIJO}menu`);
const botonPagosAnteriores = () =>
  new InlineKeyboard().text("📚 Cargar pagos anteriores", "flujo:iniciar:cargar_pagos_anteriores");

async function elegirContrato(op: string): Promise<RespuestaConsulta> {
  const contratos = await contratosRepo.listarContratosVigentes();
  if (contratos.length === 0) return { texto: "No hay contratos vigentes.", teclado: botonOtraConsulta() };
  const teclado = new InlineKeyboard();
  for (const c of contratos) {
    teclado.text(`${c.inquilino.nombreCompleto} — ${c.propiedad.direccion}`, `${PREFIJO}${op}:${c.id}`).row();
  }
  return { texto: "¿De qué contrato?", teclado };
}

async function deudasTexto(): Promise<RespuestaConsulta> {
  const deudas = await pagosService.deudasMesesAnteriores();
  if (deudas.length === 0) {
    return { texto: "No hay meses anteriores sin pago registrado. ✅", teclado: botonOtraConsulta() };
  }
  const bloques = deudas.map((d) => {
    const total = d.periodos.reduce((acc, p) => acc + Number(p.monto), 0);
    const meses = d.periodos.map((p) => formatoPeriodoAR(p.periodo)).join(", ");
    return `• ${d.inquilino} — ${d.propiedad}\n  ${d.periodos.length} mes(es), ${formatoARS(total)}: ${meses}`;
  });
  return {
    texto: [
      "⚠️ Meses anteriores sin pago registrado:",
      bloques.join("\n\n"),
      "Si esos meses ya se cobraron antes de usar el bot, cargalos de una sola vez:",
    ].join("\n\n"),
    teclado: botonOtraConsulta(botonPagosAnteriores()),
  };
}

function diasTexto(dias: number): string {
  if (dias < 0) return `atrasado ${Math.abs(dias)} día(s)`;
  if (dias === 0) return "hoy";
  return `en ${dias} día(s)`;
}

async function vencimientosTexto(tipo?: "actualizacion_alquiler"): Promise<RespuestaConsulta> {
  const items = await vencimientosService.listarVencimientos(undefined, sumarDiasISO(hoyISO(), 30), tipo);
  if (items.length === 0) {
    const nada = tipo
      ? "No hay actualizaciones de alquiler en los próximos 30 días."
      : "No vence nada en los próximos 30 días.";
    return { texto: nada, teclado: botonOtraConsulta() };
  }
  const lineas = items.map(
    (v) =>
      `• ${v.descripcion} — ${v.propiedad} — ${formatoFechaAR(v.fechaVencimiento)} (${diasTexto(v.diasRestantes)})${v.monto ? ` — ${formatoARS(v.monto)}` : ""}`,
  );
  const hayVencidas = items.some((v) => v.tipo === "actualizacion_alquiler" && v.diasRestantes <= 0);
  return {
    texto: `${tipo ? "⚡ Actualizaciones de alquiler" : "📆 Vencimientos (30 días)"}:\n\n${lineas.join("\n")}`,
    teclado: botonOtraConsulta(hayVencidas ? tecladoAlquilerActual() : undefined),
  };
}

async function gastosPendientesTexto(): Promise<string> {
  const gastos = await gastosRepo.listarPendientes();
  if (gastos.length === 0) return "No hay gastos sin pagar. ✅";
  const hoy = hoyISO();
  const lineas = gastos.map(
    (g) =>
      `• ${g.tipo} — ${g.propiedad.direccion} — vence ${formatoFechaAR(g.fechaVencimiento)} (${diasTexto(diasEntreISO(hoy, g.fechaVencimiento))})${g.monto ? ` — ${formatoARS(g.monto)}` : ""}${g.responsable ? ` — paga: ${g.responsable}` : ""}`,
  );
  return `💡 Gastos sin pagar (${gastos.length}):\n\n${lineas.join("\n")}`;
}

async function porContrato(op: string, contratoId: string): Promise<RespuestaConsulta> {
  const contrato = await contratosRepo.buscarContratoPorId(contratoId);
  if (!contrato) return { texto: "No encontré ese contrato.", teclado: botonOtraConsulta() };
  switch (op) {
    case "det":
      return { texto: await detalleContratoTexto(contrato), teclado: botonOtraConsulta() };
    case "hist": {
      const { texto, hayDeuda } = await historialPagosTexto(contrato);
      return { texto, teclado: botonOtraConsulta(hayDeuda ? botonPagosAnteriores() : undefined) };
    }
    case "gar": {
      const garantes = contrato.garantes.map(
        (g) =>
          `• ${g.persona.nombreCompleto}${g.persona.dni ? ` (DNI ${g.persona.dni})` : ""}${g.persona.telefono ? ` — tel: ${g.persona.telefono}` : ""}`,
      );
      const texto =
        garantes.length === 0
          ? `El contrato de ${contrato.inquilino.nombreCompleto} no tiene garantes cargados.`
          : `🛡️ Garantes de ${contrato.inquilino.nombreCompleto} — ${contrato.propiedad.direccion}:\n\n${garantes.join("\n")}`;
      return { texto, teclado: botonOtraConsulta() };
    }
    default:
      return { texto: "No reconozco esa consulta.", teclado: tecladoConsultas() };
  }
}

/** Resuelve un botón del menú de Consultas. */
export async function responderConsulta(datos: string): Promise<RespuestaConsulta> {
  const { op, contratoId } = parseCallbackConsulta(datos);
  if (contratoId) return porContrato(op, contratoId);

  const opcion = OPCIONES_CONSULTA.find((o) => o.op === op);
  if (opcion?.porContrato) return elegirContrato(op);

  const hoy = hoyISO();
  switch (op) {
    case "cobros":
      return { texto: `💰 Cobros del mes:\n\n${await cobrosDelMesTexto()}`, teclado: botonOtraConsulta() };
    case "deudas":
      return deudasTexto();
    case "venc":
      return vencimientosTexto();
    case "ipc":
      return vencimientosTexto("actualizacion_alquiler");
    case "gastos":
      return { texto: await gastosPendientesTexto(), teclado: botonOtraConsulta() };
    case "balmes":
    case "balanio": {
      const desde = op === "balmes" ? `${hoy.slice(0, 7)}-01` : `${hoy.slice(0, 4)}-01-01`;
      const balance = await movimientosService.calcularBalance({ desde, hasta: hoy });
      return { texto: movimientosService.formatearBalance(balance), teclado: botonOtraConsulta() };
    }
    default:
      return { texto: "¿Qué querés consultar?", teclado: tecladoConsultas() };
  }
}
