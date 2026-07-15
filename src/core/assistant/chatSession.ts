import type Anthropic from "@anthropic-ai/sdk";
import { hoyISO } from "../util/fecha.js";
import { anthropic, CLAUDE_MODEL } from "./claudeClient.js";
import { SYSTEM_PROMPT } from "./systemPrompt.js";
import { tools } from "./tools/index.js";

/**
 * Una conversación con el asistente. Mantiene el historial de mensajes para dar continuidad.
 * El Tool Runner resuelve el loop de tool use por dentro; devolvemos el texto final completo
 * (sin streaming) porque las interfaces actuales —Telegram y CLI— muestran un mensaje por respuesta.
 */
export class ChatSession {
  private readonly messages: Anthropic.Beta.BetaMessageParam[] = [];
  private primerTurno = true;

  async enviarMensaje(texto: string): Promise<string> {
    // La fecha se inyecta solo en el primer turno para no invalidar el prompt cache en cada mensaje.
    const contenido = this.primerTurno ? `[Fecha actual: ${hoyISO()}]\n\n${texto}` : texto;
    this.primerTurno = false;

    this.messages.push({ role: "user", content: contenido });

    const finalMessage = await anthropic.beta.messages.toolRunner({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      thinking: { type: "adaptive" },
      tools,
      messages: this.messages,
    });

    this.messages.push({ role: "assistant", content: finalMessage.content });

    const respuesta = finalMessage.content
      .filter((bloque): bloque is Anthropic.Beta.BetaTextBlock => bloque.type === "text")
      .map((bloque) => bloque.text)
      .join("\n")
      .trim();

    return respuesta || "(No obtuve una respuesta en texto.)";
  }

  reiniciar(): void {
    this.messages.length = 0;
    this.primerTurno = true;
  }
}
