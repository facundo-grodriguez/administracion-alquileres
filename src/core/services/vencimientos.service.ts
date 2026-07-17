import * as contratosRepo from "../repositories/contratos.repository.js";
import * as gastosRepo from "../repositories/gastosPropiedad.repository.js";
import { diasEntreISO, hoyISO, sumarDiasISO } from "../util/fecha.js";
import * as actualizacionAlquilerService from "./actualizacionAlquiler.service.js";

export type TipoVencimiento = "contrato" | "gasto" | "finaer" | "actualizacion_alquiler";

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
 * Vencimientos dentro de un rango de fechas, unificando contratos (fin de contrato), gastos de
 * propiedad, Seguro Finaer y contratos con actualización de alquiler pendiente. Si no se pasan
 * fechas, usa un horizonte de 30 días desde hoy. `tipo` filtra a un solo tipo; si se omite,
 * devuelve todos, ordenados por fecha.
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

  if (!tipo || tipo === "gasto") {
    const gastos = await gastosRepo.listarPorVencer(desdeISO, hastaISO);
    for (const g of gastos) {
      items.push({
        tipo: "gasto",
        entidadId: g.id,
        propiedad: g.propiedad.direccion,
        descripcion: `${g.tipo}${g.responsable ? ` (responsable: ${g.responsable})` : ""}`,
        fechaVencimiento: g.fechaVencimiento,
        diasRestantes: diasEntreISO(hoy, g.fechaVencimiento),
        monto: g.monto,
      });
    }
  }

  if (!tipo || tipo === "finaer") {
    const contratosConFinaer = await contratosRepo.listarFinaerPorVencer(desdeISO, hastaISO);
    for (const c of contratosConFinaer) {
      items.push({
        tipo: "finaer",
        entidadId: c.id,
        propiedad: c.propiedad.direccion,
        descripcion: `Seguro Finaer de ${c.inquilino.nombreCompleto}`,
        fechaVencimiento: c.finaerFechaVencimiento!,
        diasRestantes: diasEntreISO(hoy, c.finaerFechaVencimiento!),
        monto: null,
      });
    }
  }

  if (!tipo || tipo === "actualizacion_alquiler") {
    // Chequeo puramente por fechas (sin llamar a ARquilerAPI) para listar qué contratos ya
    // deberían actualizarse — evita gastar la API solo para armar la agenda.
    const vigentes = await contratosRepo.listarContratosVigentes();
    for (const c of vigentes) {
      if (c.indiceActualizacion !== "IPC") continue;
      const estado = await actualizacionAlquilerService.evaluarEstado(c);
      if (estado.corresponde === false && estado.motivo === "sin_indice_ipc") continue;
      const proximaFecha = estado.proximaFecha;
      if (proximaFecha > hastaISO) continue;
      items.push({
        tipo: "actualizacion_alquiler",
        entidadId: c.id,
        propiedad: c.propiedad.direccion,
        descripcion: `Actualización de alquiler de ${c.inquilino.nombreCompleto}`,
        fechaVencimiento: proximaFecha,
        diasRestantes: diasEntreISO(hoy, proximaFecha),
        monto: null,
      });
    }
  }

  items.sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));
  return items;
}
