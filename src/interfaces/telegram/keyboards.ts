import { InlineKeyboard, Keyboard } from "grammy";
import type { ContextoTeclado } from "../../core/assistant/tools/sugerirBotones.tool.js";

export const menuPrincipalKeyboard = new Keyboard()
  .text("🏠 Propiedades")
  .text("📄 Contratos")
  .row()
  .text("💰 Pagos")
  .text("➕ Nueva carga")
  .row()
  .text("📊 Resumen")
  .resized();

// Los 5 botones del menú principal (Reply Keyboard) llegan como texto normal. Desde la etapa 9,
// los 5 se resuelven sin IA (4 con una llamada directa al backend, "➕ Nueva carga" abriendo el
// selector de flujos guiados) — ver `respuestaMenuDirecto`/`tecladoNuevaCarga` en `index.ts`. Esta
// lista solo se usa para reconocer esas frases como "no es una interrupción real, es el menú" al
// detectar si el usuario abandonó un flujo guiado a mitad de camino.
export const ETIQUETAS_MENU_PRINCIPAL = [
  "🏠 Propiedades",
  "📄 Contratos",
  "💰 Pagos",
  "➕ Nueva carga",
  "📊 Resumen",
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
    { texto: "📆 Próximos vencimientos", datos: "accion:vencimientos" },
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

/** Callback_data → frase en lenguaje natural que se le manda a ChatSession, como si el usuario la hubiera tipeado. */
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
  "accion:crear_contrato": "Quiero crear un contrato para esa propiedad",
  "accion:agregar_gasto": "Quiero agregar un gasto a esa propiedad",
  "accion:ver_propiedad": "Mostrame el detalle de esa propiedad",
  "accion:registrar_pago": "Quiero registrar un pago de ese contrato",
  "accion:consultar_ipc": "¿Corresponde actualizar el alquiler de ese contrato?",
  "accion:cargar_finaer": "Quiero cargar el Seguro Finaer de ese contrato",
  "accion:ver_contrato": "Mostrame el detalle de ese contrato",
  "accion:otro_pago": "Quiero registrar otro pago",
  "accion:otro_gasto": "Quiero agregar otro gasto a esa propiedad",
  "accion:vencimientos": "¿Qué vencimientos tiene ese contrato?",
};

/** Casos de navegación pura: se resuelven sin llamar al modelo (más rápido, no gasta la API). */
export const NAV_MENU = "nav:menu";
export const NAV_CANCELAR = "nav:cancelar";

export function construirInlineKeyboard(contexto: ContextoTeclado): InlineKeyboard {
  const teclado = new InlineKeyboard();
  const botones = BOTONES[contexto];
  for (let i = 0; i < botones.length; i += 2) {
    for (const boton of botones.slice(i, i + 2)) teclado.text(boton.texto, boton.datos);
    teclado.row();
  }
  return teclado;
}

export function textoParaCallback(datos: string): string | undefined {
  return TEXTO_POR_DATO[datos];
}
