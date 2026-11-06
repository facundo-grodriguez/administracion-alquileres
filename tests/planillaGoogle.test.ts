import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { leerCredenciales, tokenDeAcceso } from "../src/core/planilla/googleAuth.js";
import { ClienteSheets, rango } from "../src/core/planilla/sheetsApi.js";
import { idDePlanilla } from "../src/core/planilla/sincronizarPlanilla.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const json = JSON.stringify({
  type: "service_account",
  client_email: "bot@proyecto.iam.gserviceaccount.com",
  private_key: pem,
});

describe("credenciales de la cuenta de servicio", () => {
  it("acepta el JSON tal cual, en base64 o con los saltos de línea escapados", () => {
    expect(leerCredenciales(json).client_email).toBe("bot@proyecto.iam.gserviceaccount.com");
    expect(leerCredenciales(Buffer.from(json).toString("base64")).private_key).toBe(pem);
    const escapado = json.replace(/\\n/g, "\\\\n");
    expect(leerCredenciales(escapado).private_key).toBe(pem);
  });

  it("explica qué falta si se pega otra cosa", () => {
    expect(() => leerCredenciales("hola")).toThrow(/no es un JSON válido/);
    expect(() => leerCredenciales('{"a":1}')).toThrow(/client_email y private_key/);
  });
});

describe("login con Google", () => {
  it("manda un JWT firmado con la clave y guarda el token hasta que vence", async () => {
    const llamadas: URLSearchParams[] = [];
    const fetchFalso = (async (_url: string, init: { body: URLSearchParams }) => {
      llamadas.push(init.body);
      return new Response(JSON.stringify({ access_token: "tok-123", expires_in: 3600 }), { status: 200 });
    }) as unknown as typeof fetch;
    const cred = leerCredenciales(json);
    expect(await tokenDeAcceso(cred, fetchFalso)).toBe("tok-123");
    expect(await tokenDeAcceso(cred, fetchFalso)).toBe("tok-123");
    expect(llamadas).toHaveLength(1); // la segunda vez usa el guardado

    const [encabezado, datos, firma] = llamadas[0]!.get("assertion")!.split(".") as [string, string, string];
    const claims = JSON.parse(Buffer.from(datos, "base64url").toString());
    expect(claims).toMatchObject({
      iss: "bot@proyecto.iam.gserviceaccount.com",
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
    });
    expect(claims.exp - claims.iat).toBe(3600);
    const valida = createVerify("RSA-SHA256").update(`${encabezado}.${datos}`).verify(publicKey, firma, "base64url");
    expect(valida).toBe(true);
  });
});

describe("planilla", () => {
  it("toma el ID del link completo o el ID solo", () => {
    expect(idDePlanilla("https://docs.google.com/spreadsheets/d/1AbC-xyz_9/edit#gid=0")).toBe("1AbC-xyz_9");
    expect(idDePlanilla(" 1AbC-xyz_9 ")).toBe("1AbC-xyz_9");
  });

  it("los nombres de pestaña van entre comillas en los rangos", () => {
    expect(rango("Gastos propiedades", "A1")).toBe("'Gastos propiedades'!A1");
    expect(rango("Resumen")).toBe("'Resumen'");
  });

  it("usa las direcciones correctas de la API de Sheets", async () => {
    const urls: string[] = [];
    const fetchFalso = (async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify({ sheets: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const cliente = new ClienteSheets("ID", async () => "token", fetchFalso);
    await cliente.pestanas();
    await cliente.cambios([{}]);
    await cliente.limpiar(["'Resumen'"]);
    await cliente.escribir([{ range: "'Resumen'!A1", values: [["x"]] }]);
    const base = "https://sheets.googleapis.com/v4/spreadsheets/ID";
    expect(urls).toEqual([
      `${base}?fields=sheets(properties(sheetId,title),basicFilter.range)`,
      `${base}:batchUpdate`,
      `${base}/values:batchClear`,
      `${base}/values:batchUpdate`,
    ]);
  });
});
