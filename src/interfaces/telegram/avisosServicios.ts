// Avisos de vencimientos de servicios (v9.8.0): el bot los manda solo, 3 días antes y el mismo día,
// con botones para marcarlo pagado o cambiar la fecha de ese mes. Se resuelven sin OpenAI.
//
// callback_data: "sv:pag:<servicioId>:<YYYY-MM>" (ya lo pagué) y "sv:fec:<servicioId>:<YYYY-MM>" (cambió la fecha).
import { type Bot, InlineKeyboard } from "grammy";
import { marcarServicioPagadoTool } from "../../core/assistant/tools/marcarServicioPagado.tool.js";
import { type DatosFlujo, etiquetaKey, type FlowId } from "../../core/flows/types.js";
import * as serviciosService from "../../core/services/serviciosVencimiento.service.js";
import { formatoFechaAR, formatoPeriodoAR, hoyISO } from "../../core/util/fecha.js";
import { nombreServicio } from "../../core/util/vencimientoServicio.js";

const PREFIJO = "sv:";

export function esCallbackServicio(datos: string): boolean {
  return datos.startsWith(PREFIJO);
}

export function parseCallbackServicio(datos: string): { accion: string; servicioId?: string; periodo?: string } {
  const [, accion, servicioId, periodo] = datos.split(":");
  return { accion: accion ?? "", servicioId, periodo };
}

export function tecladoAviso(v: { servicioId: string; periodo: string }): InlineKeyboard {
  const ref = `${v.servicioId}:${v.periodo}`;
  return new InlineKeyboard()
    .text("✅ Ya lo pagué", `${PREFIJO}pag:${ref}`)
    .text("📅 Cambió la fecha", `${PREFIJO}fec:${ref}`);
}

export type ResultadoServicio =
  | { tipo: "respuesta"; texto: string }
  | { tipo: "flujo"; flowId: FlowId; datos: DatosFlujo };

/** Resuelve un botón de un aviso. */
export async function resolverCallbackServicio(datos: string): Promise<ResultadoServicio> {
  const { accion, servicioId, periodo } = parseCallbackServicio(datos);
  const v = servicioId ? await serviciosService.obtener(servicioId, periodo) : undefined;
  if (!v || !servicioId)
    return { tipo: "respuesta", texto: "No encontré ese vencimiento. Puede que lo hayas dado de baja." };

  if (accion === "pag") {
    if (v.fechaPago) {
      return {
        tipo: "respuesta",
        texto: `${nombreServicio(v.nombre, v.propiedad)} de ${formatoPeriodoAR(v.periodo)} ya estaba pagado (el ${formatoFechaAR(v.fechaPago)}).`,
      };
    }
    return {
      tipo: "respuesta",
      texto: await marcarServicioPagadoTool.run({ servicio_id: servicioId, periodo: v.periodo }),
    };
  }

  // "Cambió la fecha": abre la modificación con el servicio y el mes ya elegidos, directo a la fecha.
  return {
    tipo: "flujo",
    flowId: "editar_vencimiento_servicio",
    datos: {
      servicio_id: servicioId,
      [etiquetaKey("servicio_id")]: nombreServicio(v.nombre, v.propiedad),
      periodo: v.periodo,
      accion: "fecha_este_mes",
    },
  };
}

/**
 * Manda los avisos que tocan hoy a cada destino. Cada aviso queda registrado (si al menos un envío
 * funcionó) para no repetirlo. Con `forzar` (comando de prueba) manda todos los pendientes de los
 * próximos días sin registrar nada.
 */
export async function enviarAvisosServicios(
  bot: Bot,
  destinos: number[],
  opciones?: { forzar?: boolean },
): Promise<number> {
  const hoy = hoyISO();
  const avisos = opciones?.forzar
    ? await serviciosService.avisosDeHoy(hoy, { ignorarEnviados: true })
    : await serviciosService.avisosDeHoy(hoy);

  for (const { item, tipo } of avisos) {
    const texto = serviciosService.textoAviso(item, tipo, hoy);
    let algunEnvioExitoso = false;
    for (const chatId of destinos) {
      try {
        await bot.api.sendMessage(chatId, texto, { reply_markup: tecladoAviso(item) });
        algunEnvioExitoso = true;
      } catch (error) {
        console.error(
          `No pude mandar el aviso de ${item.nombre} a ${chatId}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
    if (!opciones?.forzar && algunEnvioExitoso) await serviciosService.registrarAvisoEnviado(item, tipo, texto);
  }
  return avisos.length;
}
