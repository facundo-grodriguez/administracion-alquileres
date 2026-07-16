import { and, eq, ilike } from "drizzle-orm";
import { db } from "../db/client.js";
import { proveedores } from "../db/schema.js";

export type Proveedor = typeof proveedores.$inferSelect;
export type NuevoProveedor = typeof proveedores.$inferInsert;

export async function crearProveedor(datos: NuevoProveedor): Promise<Proveedor> {
  const filas = await db.insert(proveedores).values(datos).returning();
  return filas[0]!;
}

export async function obtenerProveedorPorId(id: string): Promise<Proveedor | undefined> {
  return db.query.proveedores.findFirst({ where: eq(proveedores.id, id) });
}

export async function buscarProveedores(filtros: {
  query?: string;
  categoria?: string;
  zona?: string;
}): Promise<Proveedor[]> {
  const condiciones = [];
  if (filtros.query) condiciones.push(ilike(proveedores.nombre, `%${filtros.query}%`));
  if (filtros.categoria) condiciones.push(ilike(proveedores.categoria, `%${filtros.categoria}%`));
  if (filtros.zona) condiciones.push(ilike(proveedores.zona, `%${filtros.zona}%`));

  return db
    .select()
    .from(proveedores)
    .where(condiciones.length > 0 ? and(...condiciones) : undefined)
    .orderBy(proveedores.nombre)
    .limit(50);
}
