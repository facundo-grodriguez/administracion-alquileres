import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "../db/client.js";
import { contratos, contratosGarantes } from "../db/schema.js";

export type Contrato = typeof contratos.$inferSelect;
export type NuevoContrato = typeof contratos.$inferInsert;

const conRelaciones = {
  inquilino: true,
  propiedad: { with: { propietario: true } },
  garantes: { with: { persona: true } },
} as const;

export async function crearContrato(datos: NuevoContrato, garanteIds: string[] = []): Promise<Contrato> {
  return db.transaction(async (tx) => {
    const filas = await tx.insert(contratos).values(datos).returning();
    const contrato = filas[0]!;
    if (garanteIds.length > 0) {
      await tx
        .insert(contratosGarantes)
        .values(garanteIds.map((personaId) => ({ contratoId: contrato.id, personaId })));
    }
    return contrato;
  });
}

export async function buscarContratoPorId(id: string) {
  return db.query.contratos.findFirst({ where: eq(contratos.id, id), with: conRelaciones });
}

export async function buscarContratoVigentePorPropiedad(propiedadId: string) {
  return db.query.contratos.findFirst({
    where: and(eq(contratos.propiedadId, propiedadId), eq(contratos.estado, "vigente")),
    with: conRelaciones,
  });
}

export async function buscarContratoVigentePorInquilino(inquilinoId: string) {
  return db.query.contratos.findFirst({
    where: and(eq(contratos.inquilinoId, inquilinoId), eq(contratos.estado, "vigente")),
    with: conRelaciones,
  });
}

export async function listarContratosPorVencer(desde: string, hasta: string) {
  return db.query.contratos.findMany({
    where: and(eq(contratos.estado, "vigente"), gte(contratos.fechaFin, desde), lte(contratos.fechaFin, hasta)),
    with: conRelaciones,
    orderBy: contratos.fechaFin,
  });
}

export async function listarContratosVigentes() {
  return db.query.contratos.findMany({
    where: eq(contratos.estado, "vigente"),
    with: conRelaciones,
  });
}
