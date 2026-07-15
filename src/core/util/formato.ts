/** Formatea un monto (columna numeric de Postgres, llega como string) como pesos argentinos. */
export function formatoARS(monto: string | number | null | undefined): string {
  if (monto === null || monto === undefined) return "(sin monto)";
  const numero = typeof monto === "string" ? Number(monto) : monto;
  if (Number.isNaN(numero)) return String(monto);
  return numero.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}
