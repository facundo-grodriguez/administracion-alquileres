import * as contratosRepo from "../repositories/contratos.repository.js";
import { hoyISO, sumarDiasISO } from "../util/fecha.js";

export type ContratoPorVencer = {
  contratoId: string;
  inquilino: string;
  propiedad: string;
  fechaFin: string;
};

/**
 * Contratos vigentes cuyo fin de contrato cae dentro del rango. Si no se especifican
 * fechas, usa un horizonte de 30 días desde hoy (para el resumen de agenda y consultas rápidas).
 */
export async function listarVencimientos(desde?: string, hasta?: string): Promise<ContratoPorVencer[]> {
  const desdeISO = desde ?? hoyISO();
  const hastaISO = hasta ?? sumarDiasISO(desdeISO, 30);

  const contratos = await contratosRepo.listarContratosPorVencer(desdeISO, hastaISO);

  return contratos.map((contrato) => ({
    contratoId: contrato.id,
    inquilino: contrato.inquilino.nombreCompleto,
    propiedad: contrato.propiedad.direccion,
    fechaFin: contrato.fechaFin,
  }));
}
