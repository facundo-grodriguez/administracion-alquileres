import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/config/env.js";

export const DOCUMENTOS_BUCKET = "documentos";

let cliente: SupabaseClient | null = null;

// Cliente de Supabase usado únicamente para Storage (documentos/fotos, fase 2).
// Se crea de forma perezosa: en el v1 no se usa, así que no requiere credenciales de Supabase.
// El acceso a datos relacionales pasa siempre por Drizzle (./client.ts), no por este cliente.
export function getSupabaseStorage(): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase Storage requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (la key secreta sb_secret_...). Configuralos en el .env para usar documentos/fotos.",
    );
  }
  if (!cliente) {
    cliente = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  }
  return cliente;
}
