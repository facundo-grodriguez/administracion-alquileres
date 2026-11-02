import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { db } from "./client.js";

/**
 * Cambios de esquema chicos y seguros que el bot aplica solo al arrancar, para no depender de que
 * alguien corra `npm run db:migrate` a mano después de un deploy. Cada uno es idempotente (se puede
 * correr mil veces). Los de esquema son los mismos que las migraciones de `drizzle/`; los de datos
 * acomodan lo ya cargado a una regla nueva.
 */
const CAMBIOS: { descripcion: string; sentencia: ReturnType<typeof sql> }[] = [
  {
    descripcion: "tipo de gasto 'reparacion' (migración 0005)",
    sentencia: sql`ALTER TYPE "public"."tipo_gasto" ADD VALUE IF NOT EXISTS 'reparacion' BEFORE 'otro'`,
  },
  {
    // v9.7.0: servicios, expensas, impuestos y seguro los paga el inquilino (los arreglos y "otro" se detallan).
    descripcion: "gastos de servicios sin responsable → inquilino",
    sentencia: sql`UPDATE gastos_propiedad SET responsable = 'inquilino'
      WHERE responsable IS NULL AND tipo::text NOT IN ('reparacion', 'otro')`,
  },
  {
    // Lo que paga el inquilino no se descuenta del alquiler: se saca del balance.
    descripcion: "sacar del balance los gastos que paga el inquilino",
    sentencia: sql`DELETE FROM movimientos_financieros m USING gastos_propiedad g
      WHERE m.referencia_tipo = 'gasto_propiedad' AND m.referencia_id = g.id AND g.responsable = 'inquilino'`,
  },
];

/**
 * Migraciones de `drizzle/` escritas para poder correrse varias veces (CREATE ... IF NOT EXISTS):
 * el bot las aplica solo al arrancar, leyendo el mismo archivo — así no se duplica el SQL acá.
 */
const MIGRACIONES_AL_ARRANCAR = ["0006_servicios_vencimiento.sql"];

async function aplicarMigracion(archivo: string): Promise<void> {
  const texto = await readFile(new URL(`../../../drizzle/${archivo}`, import.meta.url), "utf8");
  for (const sentencia of texto.split("--> statement-breakpoint")) {
    if (sentencia.trim()) await db.execute(sql.raw(sentencia));
  }
}

export async function asegurarEsquema(): Promise<void> {
  for (const archivo of MIGRACIONES_AL_ARRANCAR) {
    try {
      await aplicarMigracion(archivo);
    } catch (error) {
      console.error(`No pude aplicar la migración ${archivo}:`, error instanceof Error ? error.message : error);
    }
  }
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
