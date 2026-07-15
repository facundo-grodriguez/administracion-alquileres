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
