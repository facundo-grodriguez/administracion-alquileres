import "dotenv/config";
import { z } from "zod";

// Trata las cadenas vacías como ausentes (para campos opcionales seteados en "" en el .env).
const opcional = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "Falta OPENAI_API_KEY"),
  // gpt-5.4: buen equilibrio calidad/costo, disponible sin verificación adicional de cuenta.
  // La familia gpt-5.6 (sol/terra/luna) es más nueva pero tiene rollout gateado: aparece
  // listada en la API pero puede devolver 401 hasta que OpenAI habilite la cuenta/organización.
  OPENAI_MODEL: z.string().default("gpt-5.4"),

  // Conexión directa a Postgres (Supabase → Settings → Database → Transaction pooler, puerto 6543).
  DATABASE_URL: z.string().min(1, "Falta DATABASE_URL"),

  // Telegram (opcional acá; la interfaz del bot valida que TELEGRAM_BOT_TOKEN exista al arrancar).
  TELEGRAM_BOT_TOKEN: opcional,
  TELEGRAM_ALLOWED_USER_IDS: z
    .string()
    .default("")
    .transform((s) =>
      s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .map(Number)
        .filter((n) => Number.isInteger(n)),
    ),

  // Recordatorio diario (digest). El scheduler del bot manda una vez por día el resumen de la agenda.
  AGENDA_HORA: z
    .string()
    .default("09:00")
    .refine((s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s), "AGENDA_HORA debe tener formato HH:MM (24hs)"),
  AGENDA_TIMEZONE: z.string().default("America/Argentina/Buenos_Aires"),
  AGENDA_DIAS_ANTICIPACION: z.coerce.number().int().positive().default(30),

  // Supabase Storage: solo para documentos/fotos (fase 2). No se usa en el v1.
  SUPABASE_URL: opcional,
  SUPABASE_SERVICE_ROLE_KEY: opcional,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detalle = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
  throw new Error(
    `Variables de entorno inválidas o faltantes:\n${detalle}\n\nRevisá tu archivo .env (basado en .env.example).`,
  );
}

export const env = parsed.data;
