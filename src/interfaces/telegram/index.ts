import { setDefaultResultOrder } from "node:dns";
import { createServer } from "node:http";
import { Bot, webhookCallback } from "grammy";
import { env } from "../../config/env.js";
import { ChatSession } from "../../core/assistant/chatSession.js";
import { formatearResumenAgenda, obtenerResumenAgenda } from "../../core/services/agenda.service.js";
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
const autorizados = new Set<number>(env.TELEGRAM_ALLOWED_USER_IDS);

function sesionDe(chatId: number): ChatSession {
  let sesion = sesiones.get(chatId);
  if (!sesion) {
    sesion = new ChatSession();
    sesiones.set(chatId, sesion);
  }
  return sesion;
}

const AYUDA = [
  "Soy el asistente de administración de alquileres. Escribime lo que necesites, por ejemplo:",
  "• ¿Qué tengo pendiente hoy?",
  "• ¿Está pago el alquiler de Juan?",
  "• ¿Qué seguros tengo que renovar?",
  "• Cargá un seguro de La Caja para [propiedad] que vence el 30/08",
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

bot.command("start", (ctx) => ctx.reply(AYUDA));
bot.command("ayuda", (ctx) => ctx.reply(AYUDA));

bot.command("reset", (ctx) => {
  sesiones.delete(ctx.chat.id);
  return ctx.reply("Listo, arrancamos una conversación nueva.");
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

  await ctx.replyWithChatAction("typing");
  try {
    const respuesta = await sesionDe(ctx.chat.id).enviarMensaje(texto);
    for (const parte of dividirMensaje(respuesta)) {
      await ctx.reply(parte);
    }
  } catch (error) {
    console.error("Error procesando el mensaje:", error);
    await ctx.reply("Uf, ocurrió un error procesando tu pedido. Probá de nuevo en un momento.");
  }
});

bot.catch((err) => console.error("Error no capturado del bot:", err.error));

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
      manejarWebhook(req, res);
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
