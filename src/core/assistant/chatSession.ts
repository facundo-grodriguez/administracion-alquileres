import type OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { z } from "zod";
import { hoyISO } from "../util/fecha.js";
import type { ToolDefinition } from "./defineTool.js";
import { OPENAI_MODEL, openai } from "./openaiClient.js";
import { SYSTEM_PROMPT } from "./systemPrompt.js";
import { tools } from "./tools/index.js";
import type { ContextoTeclado } from "./tools/sugerirBotones.tool.js";
import { logUsoOpenAI } from "./usageLogger.js";

const MAX_ITERACIONES_TOOLS = 8;

const toolsPorNombre = new Map<string, ToolDefinition>(tools.map((tool) => [tool.name, tool]));

const toolsParaOpenAI: ChatCompletionTool[] = tools.map((tool) => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: z.toJSONSchema(tool.inputSchema) as Record<string, unknown>,
  },
}));

// Tools de alta cuyo éxito infiere solo (sin que el modelo tenga que señalarlo) qué botones
// mostrar a continuación — ver sugerir_botones.tool.ts para los contextos que sí señala el modelo.
const TOOL_A_CONTEXTO_INFERIDO: Record<string, ContextoTeclado> = {
  crear_propiedad: "post_propiedad",
  crear_contrato: "post_contrato",
  crear_recibo: "post_pago",
  crear_gasto: "post_gasto",
};

export type RespuestaAsistente = { texto: string; teclado?: ContextoTeclado };

/**
 * Una conversación con el asistente. Mantiene el historial de mensajes para dar continuidad.
 * Implementa el loop de tool-calling a mano (la Chat Completions API de OpenAI no requiere
 * un helper especial para esto: el modelo devuelve `tool_calls`, se ejecutan y se responde
 * con mensajes `role: "tool"` hasta que el modelo entrega una respuesta final en texto).
 */
export class ChatSession {
  private readonly messages: ChatCompletionMessageParam[] = [{ role: "system", content: SYSTEM_PROMPT }];
  private primerTurno = true;

  async enviarMensaje(texto: string): Promise<RespuestaAsistente> {
    // La fecha se inyecta solo en el primer turno para no repetirla en cada mensaje.
    const contenido = this.primerTurno ? `[Fecha actual: ${hoyISO()}]\n\n${texto}` : texto;
    this.primerTurno = false;

    this.messages.push({ role: "user", content: contenido });

    // Contexto de botones de este turno: lo señalado explícitamente por sugerir_botones gana
    // por sobre lo inferido automáticamente de una tool de alta exitosa (más específico).
    let contextoSenalado: ContextoTeclado | undefined;
    let contextoInferido: ContextoTeclado | undefined;

    for (let iteracion = 0; iteracion < MAX_ITERACIONES_TOOLS; iteracion++) {
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: this.messages,
        tools: toolsParaOpenAI,
        // gpt-5.4/gpt-5.6 (familia de modelos con razonamiento) exige este parámetro cuando
        // se usan tools en /v1/chat/completions; sin él, la API devuelve 400.
        reasoning_effort: "none",
        // Respuestas cortas y consistentes: este es un asistente de datos (busca/confirma/lista),
        // no necesita creatividad ni respuestas largas. `max_tokens` está deprecado y además
        // rechazado (400) por esta familia de modelos "reasoning" — el nombre vigente es
        // `max_completion_tokens` (ver node_modules/openai/resources/chat/completions/completions.d.ts).
        max_completion_tokens: 400,
        temperature: 0.2,
      });

      logUsoOpenAI(response.usage, OPENAI_MODEL, `turno ${iteracion + 1}`);

      const mensaje = response.choices[0]?.message;
      if (!mensaje) return { texto: "(No obtuve respuesta del modelo.)" };

      this.messages.push(mensaje);

      if (!mensaje.tool_calls || mensaje.tool_calls.length === 0) {
        return {
          texto: mensaje.content?.trim() || "(No obtuve una respuesta en texto.)",
          teclado: contextoSenalado ?? contextoInferido,
        };
      }

      for (const toolCall of mensaje.tool_calls) {
        const { ok, contenido } = await ejecutarTool(toolCall);
        this.messages.push({ role: "tool", tool_call_id: toolCall.id, content: contenido });
        if (!ok || toolCall.type !== "function") continue;

        if (toolCall.function.name === "sugerir_botones") {
          contextoSenalado = extraerContexto(toolCall.function.arguments);
        } else if (toolCall.function.name in TOOL_A_CONTEXTO_INFERIDO) {
          contextoInferido = TOOL_A_CONTEXTO_INFERIDO[toolCall.function.name];
        }
      }
    }

    return { texto: "Esto se está complicando más de lo esperado (demasiados pasos). Probá reformular la pregunta." };
  }

  reiniciar(): void {
    this.messages.length = 1; // deja solo el system prompt
    this.primerTurno = true;
  }
}

function extraerContexto(argumentosJson: string): ContextoTeclado | undefined {
  try {
    const args = JSON.parse(argumentosJson || "{}");
    return typeof args.contexto === "string" ? (args.contexto as ContextoTeclado) : undefined;
  } catch {
    return undefined;
  }
}

async function ejecutarTool(
  toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
): Promise<{ ok: boolean; contenido: string }> {
  if (toolCall.type !== "function") {
    return { ok: false, contenido: `Error: tipo de tool call no soportado (${toolCall.type}).` };
  }

  const tool = toolsPorNombre.get(toolCall.function.name);
  if (!tool) return { ok: false, contenido: `Error: no existe la tool "${toolCall.function.name}".` };

  try {
    const argumentosCrudos = JSON.parse(toolCall.function.arguments || "{}");
    const input = tool.inputSchema.parse(argumentosCrudos);
    const contenido = await tool.run(input);
    return { ok: true, contenido };
  } catch (error) {
    // El mensaje crudo (SQL, nombres de tabla/columna, stack) queda solo en el log del servidor.
    // Al modelo le llega una instrucción neutra: nunca debe recibir ni repetir detalles técnicos.
    console.error(`Error ejecutando la tool "${tool.name}":`, error);
    return {
      ok: false,
      contenido:
        "No se pudo completar la acción. Explicale al usuario en lenguaje simple, sin tecnicismos, que hubo un problema y pedile que verifique los datos o lo intente de nuevo.",
    };
  }
}
