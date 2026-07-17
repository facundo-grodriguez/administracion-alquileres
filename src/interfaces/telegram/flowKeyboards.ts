import { InlineKeyboard } from "grammy";
import { FLUJOS, FLUJOS_MENU_PRINCIPAL } from "../../core/flows/definiciones/index.js";
import type { CampoFlujo, ResultadoFlujo } from "../../core/flows/types.js";
import { construirInlineKeyboard } from "./keyboards.js";

const PREFIJO = "flujo:";

export function esCallbackFlujo(datos: string): boolean {
  return datos.startsWith(PREFIJO);
}

export function parseCallbackFlujo(datos: string): { accion: string; valor?: string } {
  const [, accion, ...resto] = datos.split(":");
  return { accion: accion ?? "", valor: resto.length > 0 ? resto.join(":") : undefined };
}

export function tecladoNuevaCarga(): InlineKeyboard {
  const teclado = new InlineKeyboard();
  for (let i = 0; i < FLUJOS_MENU_PRINCIPAL.length; i += 2) {
    for (const flowId of FLUJOS_MENU_PRINCIPAL.slice(i, i + 2)) {
      teclado.text(FLUJOS[flowId].titulo, `flujo:iniciar:${flowId}`);
    }
    teclado.row();
  }
  return teclado;
}

function botonCancelar(teclado: InlineKeyboard): InlineKeyboard {
  return teclado.row().text("❌ Cancelar", "flujo:cancelar");
}

function tecladoParaCampo(campo: CampoFlujo): InlineKeyboard {
  const teclado = new InlineKeyboard();

  switch (campo.tipo) {
    case "opciones": {
      for (let i = 0; i < campo.opciones.length; i += 2) {
        for (const opcion of campo.opciones.slice(i, i + 2)) teclado.text(opcion.etiqueta, `flujo:opt:${opcion.valor}`);
        teclado.row();
      }
      break;
    }
    case "confirmacion":
      return new InlineKeyboard().text("✅ Confirmar", "flujo:confirmar").text("❌ Cancelar", "flujo:cancelar");
    case "fecha":
      if (campo.permitirHoy) teclado.text("📅 Hoy", "flujo:hoy").row();
      if (campo.opcional) teclado.text("⏭️ Omitir", "flujo:omitir").row();
      break;
    case "texto":
    case "numero":
    case "monto":
    case "periodo":
      if (campo.opcional) teclado.text("⏭️ Omitir", "flujo:omitir").row();
      break;
    case "entidad":
      break; // se espera texto libre para buscar; el teclado de candidatos se arma aparte
  }

  return botonCancelar(teclado);
}

/** Convierte el resultado del motor de flujos en un mensaje listo para mandar por Telegram. */
export function renderResultado(resultado: ResultadoFlujo): { texto: string; teclado?: InlineKeyboard } {
  switch (resultado.tipo) {
    case "pregunta":
    case "reprompt":
      return { texto: resultado.texto, teclado: tecladoParaCampo(resultado.campo) };
    case "candidatos": {
      const teclado = new InlineKeyboard();
      resultado.candidatos.forEach((candidato, i) => {
        teclado.text(candidato.etiqueta, `flujo:sel:${i}`).row();
      });
      if (resultado.permiteCrear) teclado.text("➕ Crear nuevo", `flujo:crear:${resultado.permiteCrear}`).row();
      teclado.text("🔍 Buscar de nuevo", "flujo:buscar_de_nuevo").row();
      return { texto: resultado.texto, teclado: botonCancelar(teclado) };
    }
    case "completado":
      return {
        texto: resultado.texto,
        teclado: resultado.botonesPostAccion ? construirInlineKeyboard(resultado.botonesPostAccion) : undefined,
      };
    case "cancelado":
    case "interrumpido":
    case "sin_flujo":
      return { texto: "texto" in resultado ? resultado.texto : "" };
  }
}
