import { InlineKeyboard, Keyboard } from "grammy";
import type { ContextoTeclado } from "../../core/assistant/tools/sugerirBotones.tool.js";
import type { ReferenciaEntidad } from "../../core/flows/types.js";

export const menuPrincipalKeyboard = new Keyboard()
  .text("🏠 Propiedades")
  .text("📄 Contratos")
  .row()
  .text("💰 Pagos")
  .text("➕ Nueva carga")
  .row()
  .text("📊 Resumen")
  .text("🔎 Consultas")
  .row()
  .text("✏️ Modificar")
  .resized();

// Los botones del menú principal (Reply Keyboard) llegan como texto normal. Desde la etapa 9,
// todos se resuelven sin IA: "➕ Nueva carga", "🔎 Consultas" y "✏️ Modificar" abren sus botones y el resto llama
// directo al backend — ver `respuestaMenuDirecto` en `index.ts`. Esta
// lista solo se usa para reconocer esas frases como "no es una interrupción real, es el menú" al
// detectar si el usuario abandonó un flujo guiado a mitad de camino.
export const ETIQUETAS_MENU_PRINCIPAL = [
  "🏠 Propiedades",
  "📄 Contratos",
  "💰 Pagos",
  "➕ Nueva carga",
  "📊 Resumen",
  "🔎 Consultas",
  "✏️ Modificar",
] as const;

type Boton = { texto: string; datos: string };

const BOTONES: Record<ContextoTeclado, Boton[]> = {
  seleccion_persona: [
    { texto: "👤 Propietario", datos: "persona:propietario" },
    { texto: "🏠 Inquilino", datos: "persona:inquilino" },
    { texto: "🛡️ Garante", datos: "persona:garante" },
    { texto: "❌ Cancelar", datos: "nav:cancelar" },
  ],
  indice: [
    { texto: "IPC", datos: "idx:IPC" },
    { texto: "ICL", datos: "idx:ICL" },
    { texto: "Otro", datos: "idx:otro" },
  ],
  frecuencia: [
    { texto: "Mensual", datos: "frec:mensual" },
    { texto: "Trimestral", datos: "frec:trimestral" },
    { texto: "Semestral", datos: "frec:semestral" },
    { texto: "Anual", datos: "frec:anual" },
  ],
  finaer_si_no: [
    { texto: "✅ Sí", datos: "finaer:si" },
    { texto: "❌ No", datos: "finaer:no" },
  ],
  responsable_gasto: [
    { texto: "👤 Propietario", datos: "resp:propietario" },
    { texto: "🏠 Inquilino", datos: "resp:inquilino" },
  ],
  estado_pago: [
    { texto: "Pendiente", datos: "estado:pendiente" },
    { texto: "Pagado", datos: "estado:pagado" },
    { texto: "Parcial", datos: "estado:parcial" },
    { texto: "Atrasado", datos: "estado:atrasado" },
  ],
  propiedad_detalle: [
    { texto: "📄 Ver contrato", datos: "accion:ver_contrato" },
    { texto: "💰 Registrar pago", datos: "accion:registrar_pago" },
    { texto: "💡 Agregar gasto", datos: "accion:agregar_gasto" },
    { texto: "⚡ Estado del IPC", datos: "accion:consultar_ipc" },
    { texto: "🏠 Menú principal", datos: "nav:menu" },
  ],
  contrato_detalle: [
    { texto: "⚡ Actualizar IPC", datos: "accion:consultar_ipc" },
    { texto: "💰 Registrar pago", datos: "accion:registrar_pago" },
    { texto: "🛡️ Seguro Finaer", datos: "accion:cargar_finaer" },
    { texto: "📆 Próximos vencimientos", datos: "cq:venc" },
    { texto: "🏠 Volver a la propiedad", datos: "accion:ver_propiedad" },
  ],
  post_propiedad: [
    { texto: "📄 Crear contrato", datos: "accion:crear_contrato" },
    { texto: "💡 Agregar gasto", datos: "accion:agregar_gasto" },
    { texto: "👀 Ver propiedad", datos: "accion:ver_propiedad" },
    { texto: "🏠 Menú principal", datos: "nav:menu" },
  ],
  post_contrato: [
    { texto: "💰 Registrar pago", datos: "accion:registrar_pago" },
    { texto: "⚡ Consultar IPC", datos: "accion:consultar_ipc" },
    { texto: "🛡️ Cargar Seguro Finaer", datos: "accion:cargar_finaer" },
    { texto: "👀 Ver contrato", datos: "accion:ver_contrato" },
    { texto: "🏠 Menú principal", datos: "nav:menu" },
  ],
  post_pago: [
    { texto: "➕ Registrar otro pago", datos: "accion:otro_pago" },
    { texto: "📄 Ver contrato", datos: "accion:ver_contrato" },
    { texto: "🏠 Ver propiedad", datos: "accion:ver_propiedad" },
    { texto: "🏠 Menú principal", datos: "nav:menu" },
  ],
  post_gasto: [
    { texto: "➕ Agregar otro gasto", datos: "accion:otro_gasto" },
    { texto: "👀 Ver propiedad", datos: "accion:ver_propiedad" },
    { texto: "🏠 Menú principal", datos: "nav:menu" },
  ],
};

/**
 * Callback_data → frase en lenguaje natural que se le manda a ChatSession, como si el usuario la
 * hubiera tipeado. Son solo respuestas a preguntas que hizo el asistente en el chat libre (tipo de
 * persona, índice, frecuencia...). Los botones "accion:*" se resuelven sin IA en `acciones.ts`.
 */
const TEXTO_POR_DATO: Record<string, string> = {
  "persona:propietario": "Es el propietario",
  "persona:inquilino": "Es el inquilino",
  "persona:garante": "Es garante",
  "idx:IPC": "IPC",
  "idx:ICL": "ICL",
  "idx:otro": "Otro índice",
  "frec:mensual": "Mensual",
  "frec:trimestral": "Trimestral",
  "frec:semestral": "Semestral",
  "frec:anual": "Anual",
  "finaer:si": "Sí, tiene Seguro Finaer",
  "finaer:no": "No tiene Seguro Finaer",
  "resp:propietario": "Lo paga el propietario",
  "resp:inquilino": "Lo paga el inquilino",
  "estado:pendiente": "Mostrame los pagos pendientes",
  "estado:pagado": "Mostrame los pagos pagados",
  "estado:parcial": "Mostrame los pagos parciales",
  "estado:atrasado": "Mostrame los pagos atrasados",
};

// Acciones que se refieren a un contrato o a una propiedad: si se sabe cuál, viaja en el botón.
const ACCIONES_CONTRATO = new Set(["registrar_pago", "otro_pago", "cargar_finaer", "ver_contrato", "consultar_ipc"]);
const ACCIONES_PROPIEDAD = new Set(["crear_contrato", "agregar_gasto", "otro_gasto", "ver_propiedad"]);

/** Agrega al callback de una acción el id del contrato o la propiedad (≤ 64 bytes en total). */
export function datosConReferencia(datos: string, referencia?: ReferenciaEntidad): string {
  if (!referencia || !datos.startsWith("accion:")) return datos;
  const accion = datos.slice("accion:".length);
  const { contratoId, propiedadId } = referencia;
  if (ACCIONES_CONTRATO.has(accion) && contratoId) return `${datos}:c:${contratoId}`;
  if (ACCIONES_PROPIEDAD.has(accion)) {
    if (propiedadId) return `${datos}:p:${propiedadId}`;
    if (contratoId) return `${datos}:c:${contratoId}`;
  }
  if (ACCIONES_CONTRATO.has(accion) && propiedadId) return `${datos}:p:${propiedadId}`;
  return datos;
}

/** Casos de navegación pura: se resuelven sin llamar al modelo (más rápido, no gasta la API). */
export const NAV_MENU = "nav:menu";
export const NAV_CANCELAR = "nav:cancelar";

export function construirInlineKeyboard(contexto: ContextoTeclado, referencia?: ReferenciaEntidad): InlineKeyboard {
  const teclado = new InlineKeyboard();
  const botones = BOTONES[contexto];
  for (let i = 0; i < botones.length; i += 2) {
    for (const boton of botones.slice(i, i + 2)) teclado.text(boton.texto, datosConReferencia(boton.datos, referencia));
    teclado.row();
  }
  return teclado;
}

export function textoParaCallback(datos: string): string | undefined {
  return TEXTO_POR_DATO[datos];
}
