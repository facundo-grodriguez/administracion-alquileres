import { eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "../db/client.js";
import { contratos, personas, propiedades } from "../db/schema.js";

export type Propiedad = typeof propiedades.$inferSelect;
export type NuevaPropiedad = typeof propiedades.$inferInsert;
export type PropiedadConPropietario = Propiedad & { propietario: typeof personas.$inferSelect };

export async function crearPropiedad(datos: NuevaPropiedad): Promise<Propiedad> {
  const filas = await db.insert(propiedades).values(datos).returning();
  return filas[0]!;
}

export async function obtenerPropiedadPorId(id: string): Promise<Propiedad | undefined> {
  return db.query.propiedades.findFirst({ where: eq(propiedades.id, id) });
}

export async function listarPropiedades(): Promise<PropiedadConPropietario[]> {
  return db.query.propiedades.findMany({ with: { propietario: true } }) as Promise<PropiedadConPropietario[]>;
}

/** Modifica datos de una propiedad (dirección, zona, tipo, propietario). */
export async function actualizarPropiedad(
  id: string,
  datos: Partial<Pick<NuevaPropiedad, "direccion" | "zona" | "tipo" | "propietarioId">>,
): Promise<Propiedad | undefined> {
  const filas = await db
    .update(propiedades)
    .set({ ...datos, updatedAt: new Date() })
    .where(eq(propiedades.id, id))
    .returning();
  return filas[0];
}

export async function actualizarCarpetaDrive(id: string, url: string): Promise<Propiedad | undefined> {
  const filas = await db.update(propiedades).set({ carpetaDriveUrl: url }).where(eq(propiedades.id, id)).returning();
  return filas[0];
}

export async function buscarPropiedades(query: string): Promise<PropiedadConPropietario[]> {
  const patron = `%${query}%`;

  const [porDireccionZona, porPropietario, porInquilino] = await Promise.all([
    db
      .select({ id: propiedades.id })
      .from(propiedades)
      .where(or(ilike(propiedades.direccion, patron), ilike(propiedades.zona, patron))),
    db
      .select({ id: propiedades.id })
      .from(propiedades)
      .innerJoin(personas, eq(personas.id, propiedades.propietarioId))
      .where(ilike(personas.nombreCompleto, patron)),
    db
      .select({ id: contratos.propiedadId })
      .from(contratos)
      .innerJoin(personas, eq(personas.id, contratos.inquilinoId))
      .where(ilike(personas.nombreCompleto, patron)),
  ]);

  const ids = [...new Set([...porDireccionZona, ...porPropietario, ...porInquilino].map((r) => r.id))];
  if (ids.length === 0) return [];

  return db.query.propiedades.findMany({
    where: inArray(propiedades.id, ids),
    with: { propietario: true },
    limit: 20,
  }) as Promise<PropiedadConPropietario[]>;
}
