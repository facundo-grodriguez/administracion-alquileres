import * as contratosRepo from "../repositories/contratos.repository.js";
import * as personasRepo from "../repositories/personas.repository.js";
import * as propiedadesRepo from "../repositories/propiedades.repository.js";
import type { CandidatoFlujo } from "./types.js";

/** Buscador genérico para pasos "entidad" que resuelven una persona (propietario, inquilino, garante). */
export function buscarPersonasParaFlujo(rol?: "inquilino" | "propietario" | "garante") {
  return async (query: string): Promise<CandidatoFlujo[]> => {
    const personas = await personasRepo.buscarPersonas(query, rol);
    return personas.map((p) => ({
      id: p.id,
      etiqueta: `${p.nombreCompleto}${p.dni ? ` (DNI ${p.dni})` : ""}`,
    }));
  };
}

/** Buscador genérico para pasos "entidad" que resuelven una propiedad. */
export async function buscarPropiedadesParaFlujo(query: string): Promise<CandidatoFlujo[]> {
  const propiedades = await propiedadesRepo.buscarPropiedades(query);
  return propiedades.map((p) => ({
    id: p.id,
    etiqueta: `${p.direccion}${p.zona ? ` (${p.zona})` : ""} — propietario: ${p.propietario.nombreCompleto}`,
  }));
}

/**
 * Buscador genérico para pasos "entidad" que resuelven un CONTRATO VIGENTE, a partir del nombre
 * del inquilino o la dirección de la propiedad — mismo criterio que `pagosService.resolverContrato`,
 * pero devolviendo candidatos (para elegir por botón) en vez de resolver a uno solo.
 */
export async function buscarContratosVigentesParaFlujo(query: string): Promise<CandidatoFlujo[]> {
  const [personasCoincidentes, propiedadesCoincidentes] = await Promise.all([
    personasRepo.buscarPersonas(query, "inquilino"),
    propiedadesRepo.buscarPropiedades(query),
  ]);

  const contratos = await Promise.all([
    ...personasCoincidentes.map((p) => contratosRepo.buscarContratoVigentePorInquilino(p.id)),
    ...propiedadesCoincidentes.map((p) => contratosRepo.buscarContratoVigentePorPropiedad(p.id)),
  ]);

  const vistos = new Set<string>();
  const candidatos: CandidatoFlujo[] = [];
  for (const contrato of contratos) {
    if (!contrato || vistos.has(contrato.id)) continue;
    vistos.add(contrato.id);
    candidatos.push({
      id: contrato.id,
      etiqueta: `${contrato.inquilino.nombreCompleto} — ${contrato.propiedad.direccion}`,
    });
  }
  return candidatos;
}
