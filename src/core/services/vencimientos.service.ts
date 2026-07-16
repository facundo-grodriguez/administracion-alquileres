import * as contratosRepo from "../repositories/contratos.repository.js";
import * as impuestosRepo from "../repositories/impuestosServicios.repository.js";
import * as segurosRepo from "../repositories/seguros.repository.js";
import { diasEntreISO, hoyISO, sumarDiasISO } from "../util/fecha.js";

export type TipoVencimiento = "contrato" | "seguro" | "impuesto_servicio";

export type ItemVencimiento = {
  tipo: TipoVencimiento;
  entidadId: string;
  propiedad: string;
  descripcion: string;
  fechaVencimiento: string;
  diasRestantes: number;
  monto: string | null;
};

/**
 * Vencimientos dentro de un rango de fechas, unificando contratos (fin de contrato),
 * seguros e impuestos/servicios. Si no se pasan fechas, usa un horizonte de 30 días desde hoy.
 * `tipo` filtra a un solo tipo; si se omite, devuelve todos, ordenados por fecha.
 */
export async function listarVencimientos(
  desde?: string,
  hasta?: string,
  tipo?: TipoVencimiento,
): Promise<ItemVencimiento[]> {
  const hoy = hoyISO();
  const desdeISO = desde ?? hoy;
  const hastaISO = hasta ?? sumarDiasISO(desdeISO, 30);

  const items: ItemVencimiento[] = [];

  if (!tipo || tipo === "contrato") {
    const contratos = await contratosRepo.listarContratosPorVencer(desdeISO, hastaISO);
    for (const c of contratos) {
      items.push({
        tipo: "contrato",
        entidadId: c.id,
        propiedad: c.propiedad.direccion,
        descripcion: `Contrato de ${c.inquilino.nombreCompleto}`,
        fechaVencimiento: c.fechaFin,
        diasRestantes: diasEntreISO(hoy, c.fechaFin),
        monto: null,
      });
    }
  }

  if (!tipo || tipo === "seguro") {
    const seguros = await segurosRepo.listarSegurosPorVencer(desdeISO, hastaISO);
    for (const s of seguros) {
      items.push({
        tipo: "seguro",
        entidadId: s.id,
        propiedad: s.propiedad.direccion,
        descripcion: `Seguro ${s.compania}${s.numeroPoliza ? ` (póliza ${s.numeroPoliza})` : ""}`,
        fechaVencimiento: s.fechaVencimiento,
        diasRestantes: diasEntreISO(hoy, s.fechaVencimiento),
        monto: s.costo,
      });
    }
  }

  if (!tipo || tipo === "impuesto_servicio") {
    const impuestos = await impuestosRepo.listarImpuestosServiciosPorVencer(desdeISO, hastaISO);
    for (const i of impuestos) {
      items.push({
        tipo: "impuesto_servicio",
        entidadId: i.id,
        propiedad: i.propiedad.direccion,
        descripcion: `${i.tipo}${i.responsable ? ` (responsable: ${i.responsable})` : ""}`,
        fechaVencimiento: i.fechaVencimiento,
        diasRestantes: diasEntreISO(hoy, i.fechaVencimiento),
        monto: i.montoEstimado,
      });
    }
  }

  items.sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));
  return items;
}
