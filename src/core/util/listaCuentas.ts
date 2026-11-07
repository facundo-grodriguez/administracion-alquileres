// Lee la lista de cuentas que se manda con /cuentas (v9.13.0), sin IA: un rubro por línea (o
// separados por coma) con su monto, y entre paréntesis "ingreso", "vencimiento X" o "sin vincular".
import { parseMontoUsuario } from "../flows/validadores.js";

export type ItemLista =
  | {
      tipo: "rubro";
      nombre: string;
      previsto: string;
      ingreso: boolean;
      vencimiento?: string;
      desvincular: boolean;
    }
  | { tipo: "quitar"; nombre: string }
  | { tipo: "error"; texto: string };

const QUITAR = /^(?:quitar|quit[aá]|sacar|sac[aá]|borrar|borr[aá]|eliminar|elimin[aá])\s+(.+)$/i;
const VINCULO = /^(?:vinculad[oa]\s+)?(?:(?:al?|con)\s+)?(?:el\s+)?vencimiento\s+(?:de\s+)?(.+)$/i;
// Nombre y monto al final: "Gp 1/3 225285", "Sueldo $ 1.020.935".
const NOMBRE_MONTO = /^(.*\S)\s+\$?\s*(\d[\d.,]*)$/;

export function parsearListaCuentas(texto: string): ItemLista[] {
  const items: ItemLista[] = [];
  // Comas que separan rubros (no las de decimales, como 250.000,50).
  for (const crudo of texto.split(/\n|,(?=\s*[^\d\s])/)) {
    let t = crudo.replace(/^\s*[-•*·]\s*/, "").trim();
    // "armá mis cuentas: compras 250000" o un título "Mis cuentas:" → lo que va después de los dos puntos.
    if (t.includes(":")) t = t.slice(t.lastIndexOf(":") + 1).trim();
    if (!t) continue;
    const quitar = t.match(QUITAR);
    if (quitar) {
      items.push({ tipo: "quitar", nombre: quitar[1]!.trim() });
      continue;
    }
    let ingreso = false;
    let desvincular = false;
    let vencimiento: string | undefined;
    t = t
      .replace(/\(([^)]*)\)/g, (todo, dentro: string) => {
        const d = dentro.trim();
        if (/^ingreso$/i.test(d)) ingreso = true;
        else if (/sin vincular|desvincul|no vincul|aparte/i.test(d)) desvincular = true;
        else if (VINCULO.test(d)) vencimiento = d.match(VINCULO)![1]!.trim();
        else return todo; // otra cosa entre paréntesis queda en el nombre
        return " ";
      })
      .replace(/\s+/g, " ")
      .trim();
    if (/\bingreso$/i.test(t)) {
      ingreso = true;
      t = t.replace(/\s*\bingreso$/i, "");
    }
    const m = t.match(NOMBRE_MONTO);
    const previsto = m ? parseMontoUsuario(m[2]!) : null;
    if (!m || !previsto) {
      items.push({ tipo: "error", texto: crudo.trim() });
      continue;
    }
    items.push({
      tipo: "rubro",
      nombre: m[1]!.replace(/\s*\$$/, "").trim(),
      previsto,
      ingreso,
      vencimiento,
      desvincular,
    });
  }
  return items;
}
