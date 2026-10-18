/** Fecha de hoy en formato YYYY-MM-DD (huso horario local). */
export function hoyISO(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

/** Suma días a una fecha YYYY-MM-DD y devuelve el resultado en el mismo formato. */
export function sumarDiasISO(fechaISO: string, dias: number): string {
  const fecha = new Date(`${fechaISO}T00:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/**
 * Días enteros desde `desde` hasta `hasta` (ambos YYYY-MM-DD). Positivo si `hasta` es posterior.
 * Ej: diasEntreISO(hoy, fechaVencimiento) = días que faltan para el vencimiento (negativo si ya pasó).
 */
export function diasEntreISO(desde: string, hasta: string): number {
  const a = new Date(`${desde}T00:00:00`);
  const b = new Date(`${hasta}T00:00:00`);
  const MS_POR_DIA = 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / MS_POR_DIA);
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Convierte una fecha YYYY-MM-DD al formato DD/MM/AAAA para mostrarle al usuario. */
export function formatoFechaAR(fechaISO: string): string {
  const [anio, mes, dia] = fechaISO.split("-");
  if (!anio || !mes || !dia) return fechaISO;
  return `${dia}/${mes}/${anio}`;
}

/** Convierte un período YYYY-MM a "Mes AAAA" (ej: "2026-07" → "Julio 2026") para mostrarle al usuario. */
export function formatoPeriodoAR(periodoYYYYMM: string): string {
  const [anio, mes] = periodoYYYYMM.split("-");
  const nombre = MESES[Number(mes) - 1];
  if (!anio || !nombre) return periodoYYYYMM;
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}

/** Suma meses a una fecha YYYY-MM-DD y devuelve el resultado en el mismo formato. */
export function sumarMesesISO(fechaISO: string, meses: number): string {
  const fecha = new Date(`${fechaISO}T00:00:00`);
  fecha.setMonth(fecha.getMonth() + meses);
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/**
 * Última fecha de ajuste que ya pasó (o es hoy) según el calendario del contrato: inicio + N
 * veces la frecuencia. Si todavía no llegó el primer ajuste, devuelve undefined.
 * Ej: inicio 2026-02-01, trimestral, hoy 2026-10-18 → 2026-08-01.
 */
export function ultimaFechaDeAjusteISO(fechaInicio: string, frecuenciaMeses: number, hoy: string): string | undefined {
  let ultima: string | undefined;
  for (let n = 1; ; n++) {
    const fecha = sumarMesesISO(fechaInicio, n * frecuenciaMeses);
    if (fecha > hoy) return ultima;
    ultima = fecha;
  }
}

/** Lista de períodos YYYY-MM entre `desde` y `hasta`, ambos incluidos. Vacía si desde > hasta. */
export function periodosEntre(desde: string, hasta: string): string[] {
  const periodos: string[] = [];
  let [anio, mes] = desde.split("-").map(Number) as [number, number];
  for (;;) {
    const periodo = `${anio}-${String(mes).padStart(2, "0")}`;
    if (periodo > hasta) return periodos;
    periodos.push(periodo);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
  }
}
