import { sql } from "drizzle-orm";
import { db } from "./client.js";

/**
 * Cambios de esquema chicos y seguros que el bot aplica solo al arrancar, para no depender de que
 * alguien corra `npm run db:migrate` a mano después de un deploy. Cada uno es idempotente (se puede
 * correr mil veces) y solo agrega, nunca borra datos. Son los mismos que las migraciones de `drizzle/`.
 */
const CAMBIOS: { descripcion: string; sentencia: ReturnType<typeof sql> }[] = [
  {
    descripcion: "tipo de gasto 'reparacion' (migración 0005)",
    sentencia: sql`ALTER TYPE "public"."tipo_gasto" ADD VALUE IF NOT EXISTS 'reparacion' BEFORE 'otro'`,
  },
];

export async function asegurarEsquema(): Promise<void> {
  for (const cambio of CAMBIOS) {
    try {
      await db.execute(cambio.sentencia);
    } catch (error) {
      console.error(
        `No pude aplicar el cambio de esquema "${cambio.descripcion}":`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}
