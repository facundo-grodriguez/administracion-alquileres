const PALABRAS_INTERROGATIVAS = [
  "que",
  "qué",
  "cuanto",
  "cuánto",
  "cuanta",
  "cuánta",
  "cuantos",
  "cuántos",
  "cuantas",
  "cuántas",
  "como",
  "cómo",
  "cuando",
  "cuándo",
  "quien",
  "quién",
  "quienes",
  "quiénes",
  "donde",
  "dónde",
  "cual",
  "cuál",
  "cuales",
  "cuáles",
];

const PALABRAS_CANCELACION = ["cancelar", "cancela", "cancelá", "salir", "olvidalo", "olvídalo", "nada", "dejalo"];

/**
 * Heurística determinista (0 IA) para detectar que el usuario abandonó un flujo guiado a mitad
 * de camino: preguntas en lenguaje natural, frases del menú principal, comandos, o cancelación
 * explícita. Nunca se usa para validar el FORMATO de una respuesta (eso lo hacen los parsers de
 * `validadores.ts`) — solo para decidir si hay que cortar el flujo en vez de re-preguntar.
 */
export function esInterrupcion(texto: string, etiquetasMenuPrincipal: readonly string[] = []): boolean {
  const valor = texto.trim().toLowerCase();
  if (valor === "") return false;
  if (valor.startsWith("/")) return true;
  if (valor.includes("?") || valor.includes("¿")) return true;

  const primeraPalabra = valor.split(/\s+/)[0]?.replace(/[¿?¡!.,]/g, "") ?? "";
  if (PALABRAS_INTERROGATIVAS.includes(primeraPalabra)) return true;
  if (PALABRAS_CANCELACION.includes(valor)) return true;

  return etiquetasMenuPrincipal.some((etiqueta) => etiqueta.toLowerCase() === valor);
}
