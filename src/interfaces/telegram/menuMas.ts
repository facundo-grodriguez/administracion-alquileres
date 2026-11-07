// "⚙️ Más" (v9.14.0): todo lo que no está en el teclado fijo, por tema y a la vista, sin IA.
// Cada tema junta lo que se consulta y lo que se carga de ese tema.
import { InlineKeyboard } from "grammy";
import { configPlanilla, linkDePlanilla } from "../../core/planilla/sincronizarPlanilla.js";
import { listarContratosVigentesTexto, listarPropiedadesTexto } from "./menuDirecto.js";

const PREFIJO = "mas:";
export const esCallbackMas = (datos: string) => datos.startsWith(PREFIJO);

type Boton = [texto: string, datos: string];

const TEMAS: Record<string, { titulo: string; botones: Boton[] }> = {
  alq: {
    titulo: "🏠 Alquileres",
    botones: [
      ["💰 Cobros del mes", "cq:cobros"],
      ["⚠️ Meses sin pago", "cq:deudas"],
      ["🧾 Historial de pagos", "cq:hist"],
      ["⚡ Actualizaciones", "cq:ipc"],
      ["💵 Balance", "cq:bal"],
      ["🛡️ Garantes", "cq:gar"],
      ["🏠 Propiedades", "mas:prop"],
      ["📄 Contratos", "mas:contr"],
      ["📄 Ver un contrato", "cq:det"],
      ["⚡ Cargar alquiler actual", "flujo:iniciar:registrar_alquiler_actual"],
    ],
  },
  gas: {
    titulo: "💡 Gastos y servicios",
    botones: [
      ["💡 Gastos sin pagar", "cq:gastos"],
      ["📅 Servicios del mes", "cq:serv"],
      ["📆 Vencimientos (30 días)", "cq:venc"],
      ["💡 Cargar un gasto", "flujo:iniciar:crear_gasto"],
      ["🧾 Varios gastos", "flujo:iniciar:cargar_gastos"],
      ["📅 Agendar vencimiento", "flujo:iniciar:crear_vencimiento_servicio"],
    ],
  },
  altas: {
    titulo: "➕ Altas",
    botones: [
      ["👤 Persona", "flujo:iniciar:crear_persona"],
      ["🏠 Propiedad", "flujo:iniciar:crear_propiedad"],
      ["📄 Contrato", "flujo:iniciar:crear_contrato"],
      ["📚 Pagos anteriores", "flujo:iniciar:cargar_pagos_anteriores"],
      ["🛡️ Seguro Finaer", "flujo:iniciar:cargar_seguro_finaer"],
    ],
  },
};

const volver = (teclado: InlineKeyboard) => teclado.row().text("⬅️ Más", `${PREFIJO}menu`);

export function tecladoMas(): InlineKeyboard {
  const teclado = new InlineKeyboard()
    .text(TEMAS.alq!.titulo, `${PREFIJO}alq`)
    .text(TEMAS.gas!.titulo, `${PREFIJO}gas`)
    .row()
    .text(TEMAS.altas!.titulo, `${PREFIJO}altas`)
    .text("🔎 Todas las consultas", "cq:menu")
    .row();
  const planilla = configPlanilla();
  if (planilla) teclado.url("📊 Planilla de Google", linkDePlanilla(planilla.planillaId)).row();
  return teclado;
}

export const TEXTO_MAS = "¿Qué buscás?";

export async function responderMas(datos: string): Promise<{ texto: string; teclado: InlineKeyboard }> {
  const op = datos.slice(PREFIJO.length);
  if (op === "prop") return { texto: await listarPropiedadesTexto(), teclado: volver(new InlineKeyboard()) };
  if (op === "contr") return { texto: await listarContratosVigentesTexto(), teclado: volver(new InlineKeyboard()) };
  const tema = TEMAS[op];
  if (!tema) return { texto: TEXTO_MAS, teclado: tecladoMas() };
  const teclado = new InlineKeyboard();
  tema.botones.forEach(([texto, d], i) => {
    teclado.text(texto, d);
    if (i % 2 === 1) teclado.row();
  });
  return { texto: tema.titulo, teclado: volver(teclado) };
}
