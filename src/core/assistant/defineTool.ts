import type { z } from "zod";

export type ToolDefinition<Schema extends z.ZodType = z.ZodType> = {
  name: string;
  description: string;
  inputSchema: Schema;
  run: (input: z.infer<Schema>) => Promise<string>;
};

/** Define una tool del asistente de forma agnóstica al proveedor de LLM (hoy OpenAI). */
export function defineTool<Schema extends z.ZodType>(definicion: ToolDefinition<Schema>): ToolDefinition<Schema> {
  return definicion;
}
