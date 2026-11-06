import type { Bot } from "grammy";
import { schedule } from "node-cron";
import { env } from "../../config/env.js";
import { programarSincronizacion } from "../../core/planilla/sincronizarPlanilla.js";
import * as recordatoriosRepo from "../../core/repositories/recordatorios.repository.js";
import {
  formatearResumenAgenda,
  hayActualizacionesVencidas,
  obtenerResumenAgenda,
} from "../../core/services/agenda.service.js";
import { hoyISO } from "../../core/util/fecha.js";
import { enviarAvisosServicios } from "./avisosServicios.js";
import { TEXTO_AYUDA_ALQUILER_ACTUAL, tecladoAlquilerActual } from "./flowKeyboards.js";
import { dividirMensaje } from "./util.js";

const TIPO_DIGEST = "digest_diario";

/**
 * Calcula la agenda y la manda a cada chat destino.
 * Deduplica por día vía la tabla `recordatorios` (seguro ante reinicios): si ya se mandó hoy, no repite.
 * Con `forzar: true` (para el comando de prueba) manda siempre y no toca el registro del día.
 */
export async function enviarDigestDiario(
  bot: Bot,
  destinos: number[],
  opciones?: { forzar?: boolean },
): Promise<boolean> {
  const forzar = opciones?.forzar ?? false;
  const hoy = hoyISO();

  if (!forzar && (await recordatoriosRepo.yaRegistrado(TIPO_DIGEST, hoy))) {
    return false; // ya se envió el digest de hoy
  }

  const resumen = await obtenerResumenAgenda(env.AGENDA_DIAS_ANTICIPACION);
  const texto = formatearResumenAgenda(resumen);

  let algunEnvioExitoso = false;
  for (const chatId of destinos) {
    try {
      for (const parte of dividirMensaje(texto)) {
        await bot.api.sendMessage(chatId, parte);
      }
      if (hayActualizacionesVencidas(resumen)) {
        await bot.api.sendMessage(chatId, TEXTO_AYUDA_ALQUILER_ACTUAL, { reply_markup: tecladoAlquilerActual() });
      }
      algunEnvioExitoso = true;
    } catch (error) {
      console.error(`No pude enviar el recordatorio a ${chatId}:`, error);
    }
  }

  // Solo marca el día como notificado si al menos un envío funcionó; si todos fallaron
  // (ej. Telegram caído en ese momento), se reintenta al día siguiente en vez de perderse.
  if (!forzar && algunEnvioExitoso) {
    await recordatoriosRepo.registrarEnvio(TIPO_DIGEST, hoy);
  }
  return algunEnvioExitoso;
}

const dosDigitos = (n: number) => String(n).padStart(2, "0");

/** "HH:MM" de ahora, en la hora de Argentina (ver TZ en config/env). */
export function horaActual(ahora = new Date()): string {
  return `${dosDigitos(ahora.getHours())}:${dosDigitos(ahora.getMinutes())}`;
}

/** Si ya es la hora del recordatorio (o más tarde) y, por lo tanto, toca mandar lo de hoy. */
export const yaEsHora = (hora: string, horaAgenda: string) => hora >= horaAgenda;

let enCurso = false;

/**
 * La agenda del día y los avisos de servicios. No repite nada: lo ya mandado hoy queda registrado
 * en la base, así que se puede llamar muchas veces.
 */
async function tareaDiaria(bot: Bot, destinos: number[]): Promise<void> {
  if (enCurso) return;
  enCurso = true;
  try {
    const digest = await enviarDigestDiario(bot, destinos).catch((error: unknown) => {
      console.error("Falló la agenda diaria:", error);
      return false;
    });
    const avisos = await enviarAvisosServicios(bot, destinos).catch((error: unknown) => {
      console.error("Fallaron los avisos de servicios:", error);
      return 0;
    });
    if (digest || avisos > 0) {
      console.log(`Recordatorio diario: agenda ${digest ? "enviada" : "ya estaba"}, ${avisos} aviso(s) de servicios.`);
      // Con el cambio de día hay meses que pasan a "atrasado"/"vencido": se refleja en la planilla.
      programarSincronizacion(1_000);
    }
  } finally {
    enCurso = false;
  }
}

/**
 * Programa el recordatorio diario (AGENDA_HORA, AGENDA_TIMEZONE): primero la agenda y después un
 * mensaje por cada servicio que vence en 3 días o hoy (con botones).
 *
 * En el plan gratis de Render el bot se duerme si nadie le escribe, y a la hora justa puede estar
 * dormido. Por eso no depende de un único disparo: al arrancar y cada 10 minutos revisa si ya pasó
 * la hora y lo de hoy no se mandó, y lo manda apenas se despierta.
 */
export function iniciarSchedulerAgenda(bot: Bot, destinos: number[]): void {
  const revisar = () => {
    if (yaEsHora(horaActual(), env.AGENDA_HORA)) void tareaDiaria(bot, destinos);
  };
  schedule("*/10 * * * *", revisar, { timezone: env.AGENDA_TIMEZONE });
  setTimeout(revisar, 20_000); // al despertar
  console.log(
    `Recordatorio diario desde las ${env.AGENDA_HORA} (${env.AGENDA_TIMEZONE}); si el bot estaba dormido, sale al despertar.`,
  );
}
