import type { Bot } from "grammy";
import { schedule } from "node-cron";
import { env } from "../../config/env.js";
import * as recordatoriosRepo from "../../core/repositories/recordatorios.repository.js";
import {
  formatearResumenAgenda,
  hayActualizacionesVencidas,
  obtenerResumenAgenda,
} from "../../core/services/agenda.service.js";
import { hoyISO } from "../../core/util/fecha.js";
import { TEXTO_AYUDA_ALQUILER_ACTUAL, tecladoAlquilerActual } from "./flowKeyboards.js";
import { dividirMensaje } from "./util.js";

const TIPO_DIGEST = "digest_diario";

/**
 * Calcula la agenda y la manda a cada chat destino.
 * Deduplica por día vía la tabla `recordatorios` (seguro ante reinicios): si ya se mandó hoy, no repite.
 * Con `forzar: true` (para el comando de prueba) manda siempre y no toca el registro del día.
 */
export async function enviarDigestDiario(bot: Bot, destinos: number[], opciones?: { forzar?: boolean }): Promise<void> {
  const forzar = opciones?.forzar ?? false;
  const hoy = hoyISO();

  if (!forzar && (await recordatoriosRepo.yaRegistrado(TIPO_DIGEST, hoy))) {
    return; // ya se envió el digest de hoy
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
}

/** Programa el recordatorio diario a la hora configurada (AGENDA_HORA, AGENDA_TIMEZONE). */
export function iniciarSchedulerAgenda(bot: Bot, destinos: number[]): void {
  const partes = env.AGENDA_HORA.split(":");
  const hora = Number(partes[0]);
  const minuto = Number(partes[1]);
  const expresionCron = `${minuto} ${hora} * * *`; // todos los días a esa hora

  schedule(expresionCron, () => enviarDigestDiario(bot, destinos), { timezone: env.AGENDA_TIMEZONE });
  console.log(`Recordatorio diario programado a las ${env.AGENDA_HORA} (${env.AGENDA_TIMEZONE}).`);
}
