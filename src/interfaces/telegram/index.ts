import { setDefaultResultOrder } from "node:dns";
import { Bot } from "grammy";
import { env } from "../../config/env.js";
import { ChatSession } from "../../core/assistant/chatSession.js";
import { formatearResumenAgenda, obtenerResumenAgenda } from "../../core/services/agenda.service.js";

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
  "• ¿Está pago el alquiler de Juan?",
  "• ¿Qué contratos vencen este mes?",
  "• ¿Qué alquileres están atrasados?",
  "• Dá de alta a Pedro Fernández, DNI 32111222",
  "",
  "Comandos: /agenda (vencimientos y atrasos), /reset (empezar de nuevo), /ayuda",
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
    const resumen = await obtenerResumenAgenda();
    await ctx.reply(formatearResumenAgenda(resumen));
  } catch (error) {
    console.error("Error al obtener la agenda:", error);
    await ctx.reply("No pude leer la agenda. Revisá la conexión a la base de datos.");
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

/** Telegram limita los mensajes a 4096 caracteres; partimos respuestas largas por saltos de línea. */
function dividirMensaje(texto: string, max = 4000): string[] {
  if (texto.length <= max) return [texto];
  const partes: string[] = [];
  let resto = texto;
  while (resto.length > max) {
    let corte = resto.lastIndexOf("\n", max);
    if (corte < max * 0.5) corte = max;
    partes.push(resto.slice(0, corte));
    resto = resto.slice(corte);
  }
  if (resto.length > 0) partes.push(resto);
  return partes;
}

console.log("Bot de Telegram iniciado. Esperando mensajes... (Ctrl+C para detener)");
if (autorizados.size === 0) {
  console.warn(
    "Aviso: TELEGRAM_ALLOWED_USER_IDS está vacío, así que nadie está autorizado todavía. " +
      "Mandale un mensaje al bot para ver tu ID y agregalo al .env.",
  );
}

bot.start();

process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());
