// Quién paga cada gasto. Regla del negocio: los servicios, expensas, impuestos y el seguro los paga el
// inquilino, así que no se descuentan del alquiler. Los arreglos (y "otro") se detallan uno por uno.
export type Responsable = "propietario" | "inquilino";

const TIPOS_A_DETALLAR = ["reparacion", "otro"];

/** Para arreglos y "otro" hay que preguntar quién paga; el resto lo paga el inquilino. */
export function hayQueElegirResponsable(tipo: unknown): boolean {
  return TIPOS_A_DETALLAR.includes(String(tipo));
}

/** Responsable que se asume si no se eligió: inquilino para servicios; sin asumir para arreglos/otro. */
export function responsablePorDefecto(tipo: unknown): Responsable | undefined {
  return hayQueElegirResponsable(tipo) ? undefined : "inquilino";
}

/** Solo restan en el balance los gastos que no paga el inquilino. */
export function entraEnBalance(gasto: { responsable?: string | null }): boolean {
  return gasto.responsable !== "inquilino";
}
