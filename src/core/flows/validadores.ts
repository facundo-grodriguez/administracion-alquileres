import { hoyISO } from "../util/fecha.js";

/**
 * Convierte lo que el usuario escribe (DD/MM/AAAA, YYYY-MM-DD, o "hoy") a ISO (YYYY-MM-DD).
 * Devuelve null si no matchea ningún formato conocido — el motor re-pregunta sin gastar IA.
 */
export function parseFechaUsuario(texto: string): string | null {
  const valor = texto.trim().toLowerCase();
  if (valor === "hoy") return hoyISO();

  const matchISO = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (matchISO) {
    const [, anio, mes, dia] = matchISO;
    return fechaValidaISO(anio!, mes!, dia!) ? `${anio}-${mes}-${dia}` : null;
  }

  const matchAR = valor.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (matchAR) {
    const [, diaRaw, mesRaw, anio] = matchAR;
    const dia = diaRaw!.padStart(2, "0");
    const mes = mesRaw!.padStart(2, "0");
    return fechaValidaISO(anio!, mes, dia) ? `${anio}-${mes}-${dia}` : null;
  }

  return null;
}

function fechaValidaISO(anioStr: string, mesStr: string, diaStr: string): boolean {
  const anio = Number(anioStr);
  const mes = Number(mesStr);
  const dia = Number(diaStr);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;
  const fecha = new Date(`${anioStr}-${mesStr}-${diaStr}T00:00:00`);
  return fecha.getFullYear() === anio && fecha.getMonth() + 1 === mes && fecha.getDate() === dia;
}

/** Convierte "850000" | "$850.000" | "850.000,50" a un string numérico limpio ("850000" | "850000.50"). */
export function parseMontoUsuario(texto: string): string | null {
  const limpio = texto
    .trim()
    .replace(/[$\s]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // separador de miles
    .replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(limpio)) return null;
  const numero = Number(limpio);
  if (!Number.isFinite(numero) || numero <= 0) return null;
  return limpio;
}

/** Convierte "08/2026" | "2026-08" a "YYYY-MM". */
export function parsePeriodoUsuario(texto: string): string | null {
  const valor = texto.trim();

  const matchISO = valor.match(/^(\d{4})-(\d{2})$/);
  if (matchISO) {
    const [, anio, mes] = matchISO;
    return Number(mes) >= 1 && Number(mes) <= 12 ? `${anio}-${mes}` : null;
  }

  const matchAR = valor.match(/^(\d{1,2})[/-](\d{4})$/);
  if (matchAR) {
    const [, mesRaw, anio] = matchAR;
    const mes = mesRaw!.padStart(2, "0");
    return Number(mes) >= 1 && Number(mes) <= 12 ? `${anio}-${mes}` : null;
  }

  return null;
}

export function parseNumeroUsuario(texto: string, min?: number, max?: number): number | null {
  const numero = Number(texto.trim());
  if (!Number.isFinite(numero) || !Number.isInteger(numero)) return null;
  if (min !== undefined && numero < min) return null;
  if (max !== undefined && numero > max) return null;
  return numero;
}
