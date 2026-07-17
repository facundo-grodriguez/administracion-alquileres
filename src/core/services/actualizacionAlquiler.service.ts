import { env } from "../../config/env.js";
import * as actualizacionesRepo from "../repositories/actualizacionesContrato.repository.js";
import type { Contrato } from "../repositories/contratos.repository.js";
import { hoyISO } from "../util/fecha.js";

const FRECUENCIA_A_MESES: Record<string, number> = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 };

function frecuenciaMesesDe(contrato: Contrato): number {
  return FRECUENCIA_A_MESES[contrato.frecuenciaActualizacion ?? "trimestral"] ?? 3;
}

function sumarMeses(fechaISO: string, meses: number): string {
  const fecha = new Date(`${fechaISO}T00:00:00`);
  fecha.setMonth(fecha.getMonth() + meses);
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

export type EstadoActualizacion =
  | { corresponde: false; motivo: "sin_indice_ipc" }
  | { corresponde: false; motivo: "no_corresponde_todavia"; proximaFecha: string }
  | { corresponde: true; proximaFecha: string };

/**
 * Chequeo puramente interno (fechas, sin llamar a la API) para saber si un contrato ya
 * debería actualizarse. Pensado para que la agenda pueda listar "contratos a actualizar"
 * sin gastar una llamada a ARquilerAPI por cada uno.
 */
export async function evaluarEstado(contrato: Contrato): Promise<EstadoActualizacion> {
  if (contrato.indiceActualizacion !== "IPC") {
    return { corresponde: false, motivo: "sin_indice_ipc" };
  }
  const ultima = await actualizacionesRepo.obtenerUltima(contrato.id);
  const ultimaFecha = ultima?.fechaVigencia ?? contrato.fechaInicio;
  const proximaFecha = sumarMeses(ultimaFecha, frecuenciaMesesDe(contrato));

  if (hoyISO() < proximaFecha) {
    return { corresponde: false, motivo: "no_corresponde_todavia", proximaFecha };
  }
  return { corresponde: true, proximaFecha };
}

type PeriodoArquilerApi = { date: string; value: number; estimated: boolean; dif: number; amount: number };

export type ResultadoActualizacion =
  | { tipo: "sin_indice_ipc" }
  | { tipo: "no_corresponde"; proximaFecha: string }
  | { tipo: "sin_configurar" }
  | { tipo: "sin_datos_nuevos" }
  | {
      tipo: "actualizado";
      valorAnterior: string;
      valorActualizado: string;
      diferencia: number;
      fechaDesde: string;
      estimado: boolean;
    };

/**
 * Si corresponde, consulta ARquilerAPI (POST /calculate, rate="ipc", siempre con el monto y la
 * fecha ORIGINALES del contrato — la API recalcula toda la trayectoria desde ahí) y guarda el
 * último período aplicable en actualizaciones_contrato. Si no corresponde todavía, no llama a
 * la API — evita consumo innecesario.
 */
export async function actualizar(contrato: Contrato): Promise<ResultadoActualizacion> {
  const estado = await evaluarEstado(contrato);
  if (!estado.corresponde) {
    return estado.motivo === "sin_indice_ipc"
      ? { tipo: "sin_indice_ipc" }
      : { tipo: "no_corresponde", proximaFecha: estado.proximaFecha };
  }
  if (!env.RAPIDAPI_KEY) return { tipo: "sin_configurar" };

  const respuesta = await fetch(`https://${env.RAPIDAPI_HOST}/calculate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-RapidAPI-Key": env.RAPIDAPI_KEY,
      "X-RapidAPI-Host": env.RAPIDAPI_HOST,
    },
    body: JSON.stringify({
      amount: Number(contrato.valorAlquilerInicial),
      date: contrato.fechaInicio,
      months: frecuenciaMesesDe(contrato),
      rate: "ipc",
    }),
  });
  if (!respuesta.ok) throw new Error(`ARquilerAPI respondió ${respuesta.status}`);

  const json = (await respuesta.json()) as { success: boolean; data: PeriodoArquilerApi[] };
  const hoy = hoyISO();
  const periodosAplicables = json.data.filter((p) => p.date <= hoy).sort((a, b) => a.date.localeCompare(b.date));
  const ultimoPeriodo = periodosAplicables.at(-1);

  const ultima = await actualizacionesRepo.obtenerUltima(contrato.id);
  if (!ultimoPeriodo || ultimoPeriodo.date === ultima?.fechaVigencia) {
    return { tipo: "sin_datos_nuevos" };
  }

  const valorAnterior = ultima?.valorNuevo ?? contrato.valorAlquilerInicial;
  const valorActualizado = ultimoPeriodo.amount.toFixed(2);

  await actualizacionesRepo.upsert({
    contratoId: contrato.id,
    fechaVigencia: ultimoPeriodo.date,
    valorNuevo: valorActualizado,
    indiceAplicado: "IPC",
  });

  return {
    tipo: "actualizado",
    valorAnterior,
    valorActualizado,
    diferencia: Number(valorActualizado) - Number(valorAnterior),
    fechaDesde: ultimoPeriodo.date,
    estimado: ultimoPeriodo.estimated,
  };
}
