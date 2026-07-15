/** Telegram limita los mensajes a 4096 caracteres; partimos respuestas largas por saltos de línea. */
export function dividirMensaje(texto: string, max = 4000): string[] {
  if (texto.length <= max) return [texto];
  const partes: string[] = [];
  let resto = texto;
  while (resto.length > max) {
    let corte = resto.lastIndexOf("\n", max);
    if (corte < max * 0.5) corte = max;
    partes.push(resto.slice(0, corte));
    resto = resto.slice(corte);
  }
  if (resto.length > 0) partes.push(resto);
  return partes;
}
