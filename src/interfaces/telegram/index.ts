import { setDefaultResultOrder } from "node:dns";
import { createServer } from "node:http";
import type { Context } from "grammy";
import { Bot, webhookCallback } from "grammy";
import { env } from "../../config/env.js";
import { ChatSession, type RespuestaAsistente } from "../../core/assistant/chatSession.js";
import {
  CALLBACK_CANCELAR,
  cancelarFlujo,
  flujoActivo,
  iniciarFlujo,
  procesarSeleccion,
  procesarTexto,
} from "../../core/flows/flowEngine.js";
import { crearEstadoFlujo, type FlowId, type FlowState, type ResultadoFlujo } from "../../core/flows/types.js";
import { formatearResumenAgenda, obtenerResumenAgenda } from "../../core/services/agenda.service.js";
import { esCallbackFlujo, parseCallbackFlujo, renderResultado, tecladoNuevaCarga } from "./flowKeyboards.js";
import {
  construirInlineKeyboard,
  ETIQUETAS_MENU_PRINCIPAL,
  menuPrincipalKeyboard,
  NAV_CANCELAR,
  NAV_MENU,
  textoParaCallback,
} from "./keyboards.js";
import { cobrosDelMesTexto, listarContratosVigentesTexto, listarPropiedadesTexto } from "./menuDirecto.js";
import { enviarDigestDiario, iniciarSchedulerAgenda } from "./scheduler.js";
import { dividirMensaje } from "./util.js";

// En algunos entornos (Windows con IPv6 mal configurado, ciertos sandboxes) la resolución DNS
// prioriza IPv6 y api.telegram.org queda inalcanzable por esa vía. Forzar IPv4 primero evita
// timeouts de conexión sin afectar a los entornos donde IPv6 sí funciona.
setDefaultResultOrder("ipv4first");

if (!env.TELEGRAM_BOT_TOKEN) {
  throw new Error("Falta TELEGRAM_BOT_TOKEN en el .env. Pedíselo a @BotFather en Telegram con /newbot.");
}

const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

// Una conversación (con su historial) por chat de Telegram.
const sesiones = new Map<number, ChatSession>();
// Un flujo guiado (etapa 9) activo o inactivo por chat — vive aparte de la sesión de IA: mientras
// hay un flujo en curso, los mensajes no le llegan a ChatSession ni gastan la API de OpenAI.
const flujosGuiados = new Map<number, FlowState>();
const autorizados = new Set<number>(env.TELEGRAM_ALLOWED_USER_IDS);

function sesionDe(chatId: number): ChatSession {
  let sesion = sesiones.get(chatId);
  if (!sesion) {
    sesion = new ChatSession();
    sesiones.set(chatId, sesion);
  }
  return sesion;
}

function estadoFlujoDe(chatId: number): FlowState {
  let estado = flujosGuiados.get(chatId);
  if (!estado) {
    estado = crearEstadoFlujo();
    flujosGuiados.set(chatId, estado);
  }
  return estado;
}

const AYUDA = [
  "Soy el asistente de administración de alquileres. Usá los botones de abajo o escribime lo que necesites, por ejemplo:",
  "• ¿Qué tengo pendiente hoy?",
  "• ¿Está pago el alquiler de Juan?",
  "• ¿Corresponde actualizar el alquiler de Juan?",
  "• Cargá un gasto de expensas para [propiedad] que vence el 30/08",
  "• Dá de alta a Pedro Fernández, DNI 32111222",
  "",
  "Comandos: /agenda (resumen completo), /enviar_agenda (probar el recordatorio), /reset, /ayuda",
].join("\n");

// Control de acceso: un bot de Telegram es público. Solo responden los IDs autorizados;
// a cualquier otro le devolvemos su ID para que el administrador lo agregue al .env.
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (userId !== undefined && autorizados.has(userId)) {
    return next();
  }
  const id = userId ?? "desconocido";
  console.warn(`Acceso no autorizado de Telegram user id=${id}`);
  await ctx.reply(
    `🔒 No estás autorizado para usar este bot.\n\nTu ID de Telegram es: ${id}\n\n` +
      "Agregalo a TELEGRAM_ALLOWED_USER_IDS en el .env (separado por comas si hay varios) y reiniciá el bot.",
  );
});

/** Manda la respuesta del asistente, adjuntando el teclado contextual (si hay) solo al último tramo. */
async function responder(ctx: Context, respuesta: RespuestaAsistente): Promise<void> {
  const partes = dividirMensaje(respuesta.texto);
  const teclado = respuesta.teclado ? construirInlineKeyboard(respuesta.teclado) : undefined;
  for (let i = 0; i < partes.length; i++) {
    const esUltima = i === partes.length - 1;
    await ctx.reply(partes[i]!, esUltima && teclado ? { reply_markup: teclado } : undefined);
  }
}

/** Manda el resultado de un paso de flujo guiado (etapa 9), sin pasar por OpenAI en ningún caso. */
async function responderFlujo(ctx: Context, resultado: ResultadoFlujo): Promise<void> {
  const { texto, teclado } = renderResultado(resultado);
  if (!texto) return;
  const partes = dividirMensaje(texto);
  for (let i = 0; i < partes.length; i++) {
    const esUltima = i === partes.length - 1;
    await ctx.reply(partes[i]!, esUltima && teclado ? { reply_markup: teclado } : undefined);
  }
}

/** Los 4 accesos del menú principal que son consultas fijas: se resuelven directo, sin IA. */
async function respuestaMenuDirecto(texto: string): Promise<string | undefined> {
  switch (texto) {
    case "🏠 Propiedades":
      return listarPropiedadesTexto();
    case "📄 Contratos":
      return listarContratosVigentesTexto();
    case "💰 Pagos":
      return cobrosDelMesTexto();
    case "📊 Resumen":
      return formatearResumenAgenda(await obtenerResumenAgenda(env.AGENDA_DIAS_ANTICIPACION));
    default:
      return undefined;
  }
}

bot.command("start", (ctx) => ctx.reply(AYUDA, { reply_markup: menuPrincipalKeyboard }));
bot.command("ayuda", (ctx) => ctx.reply(AYUDA, { reply_markup: menuPrincipalKeyboard }));

bot.command("reset", (ctx) => {
  sesiones.delete(ctx.chat.id);
  cancelarFlujo(estadoFlujoDe(ctx.chat.id));
  return ctx.reply("Listo, arrancamos una conversación nueva.", { reply_markup: menuPrincipalKeyboard });
});

bot.command("agenda", async (ctx) => {
  await ctx.replyWithChatAction("typing");
  try {
    const resumen = await obtenerResumenAgenda(env.AGENDA_DIAS_ANTICIPACION);
    for (const parte of dividirMensaje(formatearResumenAgenda(resumen))) {
      await ctx.reply(parte);
    }
  } catch (error) {
    console.error("Error al obtener la agenda:", error);
    await ctx.reply("No pude leer la agenda. Revisá la conexión a la base de datos.");
  }
});

// Dispara el recordatorio diario en el momento (hacia quien lo pide), para probar el push.
bot.command("enviar_agenda", async (ctx) => {
  await ctx.replyWithChatAction("typing");
  try {
    await enviarDigestDiario(bot, [ctx.chat.id], { forzar: true });
  } catch (error) {
    console.error("Error al enviar el recordatorio:", error);
    await ctx.reply("No pude enviar el recordatorio.");
  }
});

bot.on("message:text", async (ctx) => {
  const texto = ctx.message.text;
  if (texto.startsWith("/")) return; // comando desconocido: lo ignoramos
  const chatId = ctx.chat.id;

  // 1) Flujo guiado activo (etapa 9): se resuelve por máquina de estados, nunca por OpenAI. Si el
  // texto no es una respuesta válida para el paso actual, se re-pregunta (tampoco gasta IA) salvo
  // que sea una interrupción real (pregunta, botón de menú, cancelación) — ahí se corta el flujo
  // y el texto original sigue el camino normal más abajo.
  const estadoFlujo = flujosGuiados.get(chatId);
  if (estadoFlujo && flujoActivo(estadoFlujo)) {
    const resultado = await procesarTexto(estadoFlujo, texto, ETIQUETAS_MENU_PRINCIPAL);
    if (resultado.tipo !== "interrumpido") {
      await responderFlujo(ctx, resultado);
      return;
    }
    cancelarFlujo(estadoFlujo);
  }

  // 2) Accesos fijos del menú principal (sin IA): son consultas deterministas, no requieren
  // interpretación — se resuelven con una llamada directa al backend.
  const directo = await respuestaMenuDirecto(texto);
  if (directo !== undefined) {
    for (const parte of dividirMensaje(directo)) await ctx.reply(parte, { reply_markup: menuPrincipalKeyboard });
    return;
  }
  if (texto === "➕ Nueva carga") {
    await ctx.reply("¿Qué querés cargar?", { reply_markup: tecladoNuevaCarga() });
    return;
  }

  // 3) Texto libre: acá sí, el asistente de IA interpreta la intención.
  await ctx.replyWithChatAction("typing");
  try {
    const respuesta = await sesionDe(chatId).enviarMensaje(texto);
    await responder(ctx, respuesta);
  } catch (error) {
    console.error("Error procesando el mensaje:", error);
    await ctx.reply("Uf, ocurrió un error procesando tu pedido. Probá de nuevo en un momento.");
  }
});

bot.on("callback_query:data", async (ctx) => {
  const datos = ctx.callbackQuery.data;
  await ctx.answerCallbackQuery();
  try {
    await ctx.editMessageReplyMarkup(); // saca el teclado del mensaje ya presionado
  } catch {
    // el mensaje puede ser muy viejo para editarlo; no es grave, seguimos igual.
  }
  const chatId = ctx.chat!.id;

  // Botones de un flujo guiado (etapa 9): siempre se resuelven por el motor, nunca por OpenAI.
  if (esCallbackFlujo(datos)) {
    const { accion, valor } = parseCallbackFlujo(datos);
    const estadoFlujo = estadoFlujoDe(chatId);
    if (accion === "iniciar" && valor) {
      await responderFlujo(ctx, await iniciarFlujo(estadoFlujo, valor as FlowId));
      return;
    }
    if (accion === CALLBACK_CANCELAR && !flujoActivo(estadoFlujo)) {
      // Cancelar sin ningún flujo activo (ej. doble tap) no debería pasar, pero por las dudas
      // no hace falta ni tocar el motor.
      await ctx.reply("Cancelado.");
      return;
    }
    await responderFlujo(ctx, await procesarSeleccion(estadoFlujo, accion, valor));
    return;
  }

  // Botones de los teclados contextuales de la etapa 8 (post-IA). "nav:menu" y "nav:cancelar" se
  // resuelven acá mismo, sin pasar por el modelo — son navegación pura, no gastan la API por eso.
  if (datos === NAV_MENU) {
    await ctx.reply("Menú principal.", { reply_markup: menuPrincipalKeyboard });
    return;
  }
  if (datos === NAV_CANCELAR) {
    await ctx.reply("Cancelado.");
    return;
  }

  const textoParaAsistente = textoParaCallback(datos);
  if (!textoParaAsistente) {
    console.warn(`callback_data desconocido: ${datos}`);
    return;
  }

  await ctx.replyWithChatAction("typing");
  try {
    const respuesta = await sesionDe(chatId).enviarMensaje(textoParaAsistente);
    await responder(ctx, respuesta);
  } catch (error) {
    console.error("Error procesando el botón:", error);
    await ctx.reply("Uf, ocurrió un error procesando tu pedido. Probá de nuevo en un momento.");
  }
});

bot.catch((err) => console.error("Error no capturado del bot:", err.error));

// Red de seguridad: un rechazo de promesa suelto (ej. la base caída) se loguea en vez de matar el proceso.
process.on("unhandledRejection", (motivo) => {
  console.error("Promesa rechazada sin capturar:", motivo instanceof Error ? motivo.message : motivo);
});

if (autorizados.size === 0) {
  console.warn(
    "Aviso: TELEGRAM_ALLOWED_USER_IDS está vacío, así que nadie está autorizado todavía. " +
      "Mandale un mensaje al bot para ver tu ID y agregalo al .env.",
  );
} else {
  // El recordatorio diario se manda a los IDs autorizados (en chats privados, chat_id == user_id).
  iniciarSchedulerAgenda(bot, [...autorizados]);
}

// Render (y otros hosts similares) exponen la URL pública en RENDER_EXTERNAL_URL automáticamente;
// WEBHOOK_URL permite fijarla a mano en otras plataformas. Si ninguna está seteada, se asume
// desarrollo local y se usa long-polling (no requiere URL pública).
const webhookUrl = process.env.WEBHOOK_URL || process.env.RENDER_EXTERNAL_URL;

if (webhookUrl) {
  // Modo webhook: pensado para hosts que duermen el proceso sin tráfico HTTP entrante (ej. el
  // free tier de Render). Cualquier request entrante lo despierta — tanto el webhook real de
  // Telegram como un ping externo (ej. un workflow de GitHub Actions) programado antes de la
  // hora del recordatorio diario, para que el scheduler interno llegue a dispararlo a tiempo.
  await bot.init();
  const manejarWebhook = webhookCallback(bot, "http");
  const puerto = Number(process.env.PORT) || 3000;
  const servidor = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/telegram-webhook") {
      // En webhook, grammY no pasa por bot.catch: si un handler falla, la promesa rechaza y
      // (sin este catch) tumba el proceso. Se responde 200 igual para que Telegram no reintente
      // el mismo update en loop. Se loguea solo el mensaje (el ctx del error incluye el token).
      Promise.resolve(manejarWebhook(req, res)).catch((err: unknown) => {
        const causa = (err as { error?: unknown })?.error ?? err;
        console.error("Error procesando update de Telegram:", causa instanceof Error ? causa.message : causa);
        if (!res.headersSent) {
          res.writeHead(200);
          res.end();
        }
      });
      return;
    }
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
  });
  await bot.api.setWebhook(`${webhookUrl}/telegram-webhook`);
  servidor.listen(puerto, () => {
    console.log(`Bot de Telegram iniciado en modo webhook (${webhookUrl}), escuchando en el puerto ${puerto}.`);
  });
  process.once("SIGINT", () => servidor.close());
  process.once("SIGTERM", () => servidor.close());
} else {
  console.log("Bot de Telegram iniciado en modo long-polling. Esperando mensajes... (Ctrl+C para detener)");
  bot.start();
  process.once("SIGINT", () => bot.stop());
  process.once("SIGTERM", () => bot.stop());
}
