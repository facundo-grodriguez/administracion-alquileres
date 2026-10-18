import { env } from "../../config/env.js";
import * as actualizacionesRepo from "../repositories/actualizacionesContrato.repository.js";
import type { Contrato } from "../repositories/contratos.repository.js";
import { hoyISO, sumarMesesISO, ultimaFechaDeAjusteISO } from "../util/fecha.js";

const FRECUENCIA_A_MESES: Record<string, number> = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 };

function frecuenciaMesesDe(contrato: Contrato): number {
  return FRECUENCIA_A_MESES[contrato.frecuenciaActualizacion ?? "trimestral"] ?? 3;
}

const INDICE_MANUAL = "manual";

/** Valor del alquiler vigente a una fecha (por defecto hoy): la última actualización cargada, o el inicial. */
export async function valorVigente(contrato: Contrato, fechaISO = hoyISO()): Promise<string> {
  const vigente = await actualizacionesRepo.obtenerVigenteAl(contrato.id, fechaISO);
  return vigente?.valorNuevo ?? contrato.valorAlquilerInicial;
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
  const proximaFecha = sumarMesesISO(ultimaFecha, frecuenciaMesesDe(contrato));

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
 * Si corresponde, consulta ARquilerAPI (POST /calculate, rate="ipc") y guarda el último período
 * aplicable en actualizaciones_contrato. Se manda el monto y la fecha ORIGINALES del contrato (la
 * API recalcula toda la trayectoria desde ahí), salvo que la última actualización se haya cargado
 * a mano: ahí se parte de ese monto real, para no pisarlo con un valor teórico. Si no corresponde todavía, no llama a
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

  const ultima = await actualizacionesRepo.obtenerUltima(contrato.id);
  const base =
    ultima?.indiceAplicado === INDICE_MANUAL
      ? { monto: ultima.valorNuevo, fecha: ultima.fechaVigencia }
      : { monto: contrato.valorAlquilerInicial, fecha: contrato.fechaInicio };

  const respuesta = await fetch(`https://${env.RAPIDAPI_HOST}/calculate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-RapidAPI-Key": env.RAPIDAPI_KEY,
      "X-RapidAPI-Host": env.RAPIDAPI_HOST,
    },
    body: JSON.stringify({
      amount: Number(base.monto),
      date: base.fecha,
      months: frecuenciaMesesDe(contrato),
      rate: "ipc",
    }),
  });
  if (!respuesta.ok) throw new Error(`ARquilerAPI respondió ${respuesta.status}`);

  const json = (await respuesta.json()) as { success: boolean; data: PeriodoArquilerApi[] };
  const hoy = hoyISO();
  const periodosAplicables = json.data.filter((p) => p.date <= hoy).sort((a, b) => a.date.localeCompare(b.date));
  const ultimoPeriodo = periodosAplicables.at(-1);

  if (!ultimoPeriodo || (ultima && ultimoPeriodo.date <= ultima.fechaVigencia)) {
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

export type ResultadoActualizacionManual =
  | { tipo: "todavia_no_corresponde"; proximaFecha: string }
  | { tipo: "registrado"; valorAnterior: string; valorNuevo: string; fechaVigencia: string; proximaFecha: string };

/**
 * Registra a mano el alquiler que se está pagando hoy (o confirma que sigue igual si no se pasa
 * monto). Sirve cuando el aumento ya se aplicó por fuera del bot: deja el valor vigente al día
 * para los cobros y saca la alerta de "actualización pendiente" hasta el próximo ajuste.
 * Si no se indica fecha, se toma la del último ajuste que correspondía según el calendario.
 */
export async function registrarManual(
  contrato: Contrato,
  opciones: { monto?: string; fechaVigencia?: string } = {},
): Promise<ResultadoActualizacionManual> {
  const meses = frecuenciaMesesDe(contrato);
  const hoy = hoyISO();
  const fechaVigencia = opciones.fechaVigencia ?? ultimaFechaDeAjusteISO(contrato.fechaInicio, meses, hoy);
  if (!fechaVigencia) {
    return { tipo: "todavia_no_corresponde", proximaFecha: sumarMesesISO(contrato.fechaInicio, meses) };
  }

  const valorAnterior = await valorVigente(contrato, hoy);
  const valorNuevo = opciones.monto ? Number(opciones.monto).toFixed(2) : valorAnterior;

  await actualizacionesRepo.upsert({
    contratoId: contrato.id,
    fechaVigencia,
    valorNuevo,
    indiceAplicado: INDICE_MANUAL,
  });

  return {
    tipo: "registrado",
    valorAnterior,
    valorNuevo,
    fechaVigencia,
    proximaFecha: sumarMesesISO(fechaVigencia, meses),
  };
}
