// Cliente mínimo de la API de Google Sheets v4 (solo lo que usa la planilla), sobre fetch.

const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export type PestanaExistente = { id: number; titulo: string; conFiltro: boolean };

export class ClienteSheets {
  constructor(
    private readonly planillaId: string,
    private readonly token: () => Promise<string>,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private async llamar<T>(ruta: string, cuerpo?: unknown): Promise<T> {
    const respuesta = await this.fetchFn(`${BASE}/${this.planillaId}${ruta}`, {
      method: cuerpo === undefined ? "GET" : "POST",
      headers: { authorization: `Bearer ${await this.token()}`, "content-type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    if (!respuesta.ok) {
      const texto = await respuesta.text();
      // Google a veces responde con una página HTML: no tiene sentido mostrarla.
      const detalle = texto.trimStart().startsWith("<") ? "" : texto.slice(0, 300);
      if (respuesta.status === 403 || respuesta.status === 404) {
        throw new Error(
          `No puedo abrir la planilla (${respuesta.status}). ¿La compartiste como Editor con la cuenta de servicio? ${detalle}`,
        );
      }
      throw new Error(`Google Sheets respondió ${respuesta.status}: ${detalle}`);
    }
    return (await respuesta.json()) as T;
  }

  async pestanas(): Promise<PestanaExistente[]> {
    const json = await this.llamar<{
      sheets: { properties: { sheetId: number; title: string }; basicFilter?: unknown }[];
    }>("?fields=sheets(properties(sheetId,title),basicFilter.range)");
    return json.sheets.map((s) => ({
      id: s.properties.sheetId,
      titulo: s.properties.title,
      conFiltro: s.basicFilter !== undefined,
    }));
  }

  async cambios(requests: unknown[]): Promise<{ replies?: { addSheet?: { properties: { sheetId: number } } }[] }> {
    if (requests.length === 0) return {};
    return this.llamar(":batchUpdate", { requests });
  }

  async limpiar(rangos: string[]): Promise<void> {
    await this.llamar("/values:batchClear", { ranges: rangos });
  }

  async escribir(datos: { range: string; values: unknown[][] }[]): Promise<void> {
    await this.llamar("/values:batchUpdate", { valueInputOption: "USER_ENTERED", data: datos });
  }
}

/** Nombre de pestaña listo para un rango A1 ('Gastos propiedades'!A1). */
export const rango = (titulo: string, celdas = "") => `'${titulo.replace(/'/g, "''")}'${celdas ? `!${celdas}` : ""}`;
