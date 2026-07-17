import type { CompletionUsage } from "openai/resources/completions";
import { env } from "../../config/env.js";

// USD por 1M tokens. Fuente: developers.openai.com/api/docs/pricing (verificado en vivo).
// Si se usa un modelo no listado acá, se muestran los tokens igual, sin costo estimado.
const PRECIOS_POR_1M_TOKENS: Record<string, { input: number; output: number }> = {
  "gpt-5.6-sol": { input: 5.0, output: 30.0 },
  "gpt-5.6-terra": { input: 2.5, output: 15.0 },
  "gpt-5.6-luna": { input: 1.0, output: 6.0 },
  "gpt-5.5": { input: 5.0, output: 30.0 },
  "gpt-5.5-pro": { input: 30.0, output: 180.0 },
  "gpt-5.4": { input: 2.5, output: 15.0 },
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
  "gpt-5.4-nano": { input: 0.2, output: 1.25 },
  "gpt-5.4-pro": { input: 30.0, output: 180.0 },
};

function estimarCostoUSD(modelo: string, promptTokens: number, completionTokens: number): number | null {
  const precio = PRECIOS_POR_1M_TOKENS[modelo];
  if (!precio) return null;
  return (promptTokens / 1_000_000) * precio.input + (completionTokens / 1_000_000) * precio.output;
}

/**
 * Loguea por consola el uso de tokens (y costo estimado, si el modelo está en la tabla de precios)
 * de una llamada a la Chat Completions API. Solo hace algo si DEBUG_AI=true; pensado para
 * desarrollo, no para dejar prendido en producción (es ruidoso y expone conteos por llamada).
 */
export function logUsoOpenAI(usage: CompletionUsage | undefined, modelo: string, contexto?: string): void {
  if (!env.DEBUG_AI) return;
  if (!usage) {
    console.log(`[DEBUG_AI]${contexto ? ` ${contexto}` : ""} sin datos de uso en la respuesta.`);
    return;
  }

  const { prompt_tokens, completion_tokens, total_tokens, prompt_tokens_details, completion_tokens_details } = usage;
  const costo = estimarCostoUSD(modelo, prompt_tokens, completion_tokens);
  const costoTexto = costo === null ? "desconocido (modelo no está en la tabla de precios)" : `~US$${costo.toFixed(5)}`;

  const partes = [
    `[DEBUG_AI]${contexto ? ` ${contexto}` : ""} modelo=${modelo}`,
    `entrada=${prompt_tokens}`,
    `salida=${completion_tokens}`,
    `total=${total_tokens}`,
    `costo=${costoTexto}`,
  ];

  if (prompt_tokens_details?.cached_tokens) {
    partes.push(`(de los cuales ${prompt_tokens_details.cached_tokens} de entrada cacheados, a menor costo)`);
  }
  if (completion_tokens_details?.reasoning_tokens) {
    partes.push(`(de los cuales ${completion_tokens_details.reasoning_tokens} de salida son de razonamiento)`);
  }

  console.log(partes.join(" | "));
}
