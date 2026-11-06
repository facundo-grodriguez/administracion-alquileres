// Mantiene al día la planilla de Google (v9.10.0): después de cada cambio en el bot (con una espera
// corta para juntar varios), arma las pestañas desde la base y, si algo cambió, las reescribe enteras.
// Es opcional: sin GOOGLE_SERVICE_ACCOUNT_JSON y GOOGLE_SHEET_ID no hace nada. Nunca rompe el bot.
import { createHash } from "node:crypto";
import { env } from "../../config/env.js";
import { armarPlanilla, type Celda, type Pestana, type TipoColumna } from "./armarPlanilla.js";
import { type CredencialesGoogle, leerCredenciales, tokenDeAcceso } from "./googleAuth.js";
import { ClienteSheets, type PestanaExistente, rango } from "./sheetsApi.js";

export type ConfigPlanilla = { planillaId: string; cred: CredencialesGoogle };

/** Acepta el ID o el link completo de la planilla (https://docs.google.com/spreadsheets/d/<ID>/edit). */
export function idDePlanilla(valor: string): string {
  return valor.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1] ?? valor.trim();
}

export const linkDePlanilla = (planillaId: string) => `https://docs.google.com/spreadsheets/d/${planillaId}/edit`;

let config: ConfigPlanilla | null | undefined;

/** La configuración de la planilla, o undefined si no está (o está mal: se avisa una sola vez en el log). */
export function configPlanilla(): ConfigPlanilla | undefined {
  if (config === undefined) {
    config = null;
    if (env.GOOGLE_SERVICE_ACCOUNT_JSON && env.GOOGLE_SHEET_ID) {
      try {
        config = {
          planillaId: idDePlanilla(env.GOOGLE_SHEET_ID),
          cred: leerCredenciales(env.GOOGLE_SERVICE_ACCOUNT_JSON),
        };
      } catch (error) {
        console.error("Planilla de Google desactivada:", error instanceof Error ? error.message : error);
      }
    }
  }
  return config ?? undefined;
}

// Pestañas que trae una planilla nueva: la primera se reusa como "Resumen" en vez de quedar vacía.
const PESTANAS_POR_DEFECTO = ["Hoja 1", "Hoja1", "Sheet1"];

const FORMATOS: Record<Exclude<TipoColumna, "texto">, { type: string; pattern: string }> = {
  fecha: { type: "DATE", pattern: "dd/mm/yyyy" },
  mes: { type: "DATE", pattern: "mmmm yyyy" },
  monto: { type: "CURRENCY", pattern: '"$" #,##0' },
};

/** Texto que Google tomaría como fórmula (empieza con = + - @) se escribe como texto. */
function celda(valor: Celda): string | number {
  if (valor === null) return "";
  if (typeof valor === "number") return valor;
  return /^[=+\-@]/.test(valor) ? `'${valor}` : valor;
}

function actualizadoEl(): string {
  const fecha = new Intl.DateTimeFormat("es-AR", {
    timeZone: env.AGENDA_TIMEZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
  return `Actualizado el ${fecha} — se actualiza sola con cada cambio que hagas en el bot.`;
}

function valores(p: Pestana, esResumen: boolean): (string | number)[][] {
  const filas = [p.columnas.map((c) => c.titulo), ...p.filas.map((f) => f.map(celda))];
  if (esResumen) filas.push([], [actualizadoEl()]);
  return filas;
}

const BLANCO = { red: 1, green: 1, blue: 1 };

/**
 * Formato de cada pestaña: encabezado fijo y en negrita, fechas y montos con su formato, colores de
 * cada celda, totales en negrita y columnas a medida. Antes se limpia el formato de los datos, por si
 * la pestaña tenía otra forma.
 */
function formato(p: Pestana, hoja: PestanaExistente, esNueva: boolean): unknown[] {
  const sheetId = hoja.id;
  const requests: unknown[] = [
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1, frozenColumnCount: p.columnasFijas ?? 0 } },
        fields: "gridProperties(frozenRowCount,frozenColumnCount)",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            backgroundColor: { red: 0.9, green: 0.93, blue: 0.97 },
          },
        },
        fields: "userEnteredFormat(textFormat,backgroundColor)",
      },
    },
    // Datos sin formato previo (negritas, colores y formatos de una versión anterior de la pestaña).
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: false }, backgroundColor: BLANCO } },
        fields: "userEnteredFormat(textFormat.bold,backgroundColor,numberFormat)",
      },
    },
  ];
  p.columnas.forEach((c, i) => {
    if (!c.tipo || c.tipo === "texto") return;
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: i, endColumnIndex: i + 1 },
        cell: { userEnteredFormat: { numberFormat: FORMATOS[c.tipo] } },
        fields: "userEnteredFormat.numberFormat",
      },
    });
  });
  for (const fila of p.negritas ?? []) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: fila + 1, endRowIndex: fila + 2 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: "userEnteredFormat.textFormat.bold",
      },
    });
  }
  (p.fondos ?? []).forEach((fila, f) => {
    fila.forEach((color, c) => {
      if (!color) return;
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: f + 1, endRowIndex: f + 2, startColumnIndex: c, endColumnIndex: c + 1 },
          cell: { userEnteredFormat: { backgroundColor: color } },
          fields: "userEnteredFormat.backgroundColor",
        },
      });
    });
  });
  requests.push({
    autoResizeDimensions: {
      dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: p.columnas.length },
    },
  });
  // El filtro se pone solo al crear la pestaña, para no borrar el que hayas elegido después.
  if (p.sinFiltro) {
    if (hoja.conFiltro) requests.push({ clearBasicFilter: { sheetId } });
  } else if (esNueva) requests.push({ setBasicFilter: { filter: { range: { sheetId } } } });
  return requests;
}

let ultimaHuella = "";

export type ResultadoSincronizacion = "actualizada" | "sin_cambios" | "no_configurada";

export async function sincronizarPlanilla(opciones?: {
  forzar?: boolean;
  config?: ConfigPlanilla;
  fetchFn?: typeof fetch;
  hoy?: string;
}): Promise<ResultadoSincronizacion> {
  const conf = opciones?.config ?? configPlanilla();
  if (!conf) return "no_configurada";
  const fetchFn = opciones?.fetchFn ?? fetch;

  const pestanas = await armarPlanilla(opciones?.hoy);
  const huella = createHash("sha1").update(JSON.stringify(pestanas)).digest("hex");
  if (!opciones?.forzar && huella === ultimaHuella) return "sin_cambios";

  const cliente = new ClienteSheets(conf.planillaId, () => tokenDeAcceso(conf.cred, fetchFn), fetchFn);
  let existentes = await cliente.pestanas();

  // Crear las pestañas que falten (la primera reusa la "Hoja 1" de una planilla nueva).
  const nuevas = new Set<string>();
  const altas: unknown[] = [];
  pestanas.forEach((p, i) => {
    if (existentes.some((e) => e.titulo === p.titulo)) return;
    const porDefecto = i === 0 ? existentes.find((e) => PESTANAS_POR_DEFECTO.includes(e.titulo)) : undefined;
    altas.push(
      porDefecto
        ? { updateSheetProperties: { properties: { sheetId: porDefecto.id, title: p.titulo }, fields: "title" } }
        : { addSheet: { properties: { title: p.titulo, index: i } } },
    );
    nuevas.add(p.titulo);
  });
  if (altas.length > 0) {
    await cliente.cambios(altas);
    existentes = await cliente.pestanas();
  }

  await cliente.limpiar(pestanas.map((p) => rango(p.titulo)));
  await cliente.escribir(pestanas.map((p, i) => ({ range: rango(p.titulo, "A1"), values: valores(p, i === 0) })));
  await cliente.cambios(
    pestanas.flatMap((p) => {
      const hoja = existentes.find((e) => e.titulo === p.titulo);
      return hoja ? formato(p, hoja, nuevas.has(p.titulo)) : [];
    }),
  );
  ultimaHuella = huella;
  return "actualizada";
}

let temporizador: ReturnType<typeof setTimeout> | undefined;
let enCurso = false;
let repetir = false;

async function correr(): Promise<void> {
  if (enCurso) {
    repetir = true; // terminó otro cambio mientras escribía: se vuelve a pasar al final
    return;
  }
  enCurso = true;
  try {
    await sincronizarPlanilla();
  } catch (error) {
    console.error("No pude actualizar la planilla de Google:", error instanceof Error ? error.message : error);
  } finally {
    enCurso = false;
  }
  if (repetir) {
    repetir = false;
    await correr();
  }
}

/** Pide actualizar la planilla en unos segundos (si llegan más cambios, espera a que terminen). */
export function programarSincronizacion(demoraMs = 15_000): void {
  if (!configPlanilla()) return;
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => void correr(), demoraMs);
}
