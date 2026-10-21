import { readFile } from "node:fs/promises";
import type { Bot } from "grammy";
import * as recordatoriosRepo from "../../core/repositories/recordatorios.repository.js";
import { hoyISO } from "../../core/util/fecha.js";
import { menuPrincipalKeyboard } from "./keyboards.js";

const RAIZ = new URL("../../../", import.meta.url);

/** Título de una versión en el CHANGELOG ("## [9.3.0] — fecha — Título" → "Título"). */
export function tituloVersion(changelog: string, version: string): string | undefined {
  const linea = changelog.split("\n").find((l) => l.startsWith(`## [${version}]`));
  const partes = linea?.split(" — ");
  return partes && partes.length >= 3 ? partes.slice(2).join(" — ").trim() : undefined;
}

/**
 * Ítems cortos para Telegram de una versión: las líneas que empiezan con "> " dentro de su entrada
 * del CHANGELOG (hasta el próximo "## "). Si no tiene, se usa el título.
 */
export function novedadesVersion(changelog: string, version: string): string[] {
  const lineas = changelog.split("\n");
  const inicio = lineas.findIndex((l) => l.startsWith(`## [${version}]`));
  if (inicio === -1) return [];
  const items: string[] = [];
  for (const linea of lineas.slice(inicio + 1)) {
    if (linea.startsWith("## ")) break;
    if (linea.startsWith("> ")) items.push(linea.slice(2).trim());
  }
  if (items.length > 0) return items;
  const titulo = tituloVersion(changelog, version);
  return titulo ? [titulo] : [];
}

/**
 * Al arrancar una versión nueva, manda a los usuarios autorizados un aviso con el menú principal
 * actualizado — así el teclado de Telegram se refresca solo, sin tener que mandar /start. Se avisa
 * una sola vez por versión (queda registrado en `recordatorios`): los reinicios de Render (ej. cuando
 * el plan gratis despierta el proceso) no repiten el mensaje.
 */
export async function avisarVersionNueva(bot: Bot, destinos: number[]): Promise<void> {
  const paquete = JSON.parse(await readFile(new URL("package.json", RAIZ), "utf8")) as { version: string };
  const version = paquete.version;
  const tipo = `aviso_version:${version}`;
  if (await recordatoriosRepo.yaRegistradoAlgunaVez(tipo)) return;

  const changelog = await readFile(new URL("CHANGELOG.md", RAIZ), "utf8").catch(() => "");
  const items = novedadesVersion(changelog, version).map((item) => `• ${item}`);
  const texto = [`✅ Bot actualizado a v${version}`, ...items, "Menú al día 👇"].join("\n");

  let algunEnvioExitoso = false;
  for (const chatId of destinos) {
    try {
      await bot.api.sendMessage(chatId, texto, { reply_markup: menuPrincipalKeyboard });
      algunEnvioExitoso = true;
    } catch (error) {
      console.error(`No pude avisar la versión nueva a ${chatId}:`, error instanceof Error ? error.message : error);
    }
  }
  if (algunEnvioExitoso) await recordatoriosRepo.registrarEnvio(tipo, hoyISO(), texto);
}
