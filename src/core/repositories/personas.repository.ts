import { and, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "../db/client.js";
import { contratos, contratosGarantes, personas, propiedades } from "../db/schema.js";

export type Persona = typeof personas.$inferSelect;
export type NuevaPersona = typeof personas.$inferInsert;

export type RolPersona = "inquilino" | "propietario" | "garante";

export async function crearPersona(datos: NuevaPersona): Promise<Persona> {
  const filas = await db.insert(personas).values(datos).returning();
  return filas[0]!;
}

export async function buscarPersonaPorId(id: string): Promise<Persona | undefined> {
  return db.query.personas.findFirst({ where: eq(personas.id, id) });
}

export async function buscarPersonas(query: string, rol?: RolPersona): Promise<Persona[]> {
  const patron = `%${query}%`;
  const condiciones = [
    or(ilike(personas.nombreCompleto, patron), ilike(personas.dni, patron), ilike(personas.telefono, patron)),
  ];

  if (rol === "propietario") {
    condiciones.push(inArray(personas.id, db.selectDistinct({ id: propiedades.propietarioId }).from(propiedades)));
  } else if (rol === "inquilino") {
    condiciones.push(inArray(personas.id, db.selectDistinct({ id: contratos.inquilinoId }).from(contratos)));
  } else if (rol === "garante") {
    condiciones.push(
      inArray(personas.id, db.selectDistinct({ id: contratosGarantes.personaId }).from(contratosGarantes)),
    );
  }

  return db
    .select()
    .from(personas)
    .where(and(...condiciones))
    .limit(20);
}
