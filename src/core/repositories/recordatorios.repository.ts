import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { recordatorios } from "../db/schema.js";

// entidadId es NOT NULL en el schema; para eventos "de sistema" (como el digest diario, que no
// apunta a una entidad concreta) usamos este UUID centinela fijo.
const ENTIDAD_SISTEMA = "00000000-0000-0000-0000-000000000000";

/**
 * ¿Ya se registró un recordatorio de este tipo para esta fecha de evento? Se usa para deduplicar
 * el digest diario y no reenviarlo si el bot se reinicia el mismo día.
 */
export async function yaRegistrado(tipo: string, fechaEvento: string): Promise<boolean> {
  const fila = await db.query.recordatorios.findFirst({
    where: and(eq(recordatorios.tipo, tipo), eq(recordatorios.fechaEvento, fechaEvento)),
  });
  return fila !== undefined;
}

export async function registrarEnvio(tipo: string, fechaEvento: string, mensaje?: string): Promise<void> {
  await db.insert(recordatorios).values({
    tipo,
    entidadTipo: "sistema",
    entidadId: ENTIDAD_SISTEMA,
    fechaEvento,
    estado: "notificado",
    mensaje,
  });
}

/** ¿Ya se registró alguna vez un recordatorio de este tipo (sin importar la fecha)? */
export async function yaRegistradoAlgunaVez(tipo: string): Promise<boolean> {
  const fila = await db.query.recordatorios.findFirst({ where: eq(recordatorios.tipo, tipo) });
  return fila !== undefined;
}
