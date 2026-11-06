// Login de una cuenta de servicio de Google (JWT firmado con su clave privada → token de acceso),
// con lo que ya trae Node: sin agregar dependencias. Doc: developers.google.com/identity/protocols/oauth2/service-account
import { createSign } from "node:crypto";

export type CredencialesGoogle = { client_email: string; private_key: string };

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const URL_TOKEN = "https://oauth2.googleapis.com/token";

/** Acepta el JSON de la cuenta de servicio tal cual (o en base64, por si se pega en una sola línea). */
export function leerCredenciales(valor: string): CredencialesGoogle {
  const texto = valor.trim().startsWith("{") ? valor : Buffer.from(valor.trim(), "base64").toString("utf8");
  let json: Partial<CredencialesGoogle>;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON no es un JSON válido: pegá el contenido completo del archivo .json.");
  }
  if (!json.client_email || !json.private_key) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON no tiene client_email y private_key: ¿es el .json de la cuenta de servicio?",
    );
  }
  // Si se pegó con los saltos de línea escapados, se restauran.
  return { client_email: json.client_email, private_key: json.private_key.replace(/\\n/g, "\n") };
}

const base64url = (texto: string) => Buffer.from(texto).toString("base64url");

let cache: { email: string; token: string; venceEn: number } | undefined;

export async function tokenDeAcceso(cred: CredencialesGoogle, fetchFn: typeof fetch = fetch): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000);
  if (cache && cache.email === cred.client_email && cache.venceEn - 60 > ahora) return cache.token;

  const encabezado = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const datos = base64url(
    JSON.stringify({ iss: cred.client_email, scope: SCOPE, aud: URL_TOKEN, iat: ahora, exp: ahora + 3600 }),
  );
  const firma = createSign("RSA-SHA256").update(`${encabezado}.${datos}`).sign(cred.private_key, "base64url");
  const respuesta = await fetchFn(URL_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${encabezado}.${datos}.${firma}`,
    }),
  });
  if (!respuesta.ok) {
    throw new Error(
      `Google no aceptó la cuenta de servicio (${respuesta.status}): ${(await respuesta.text()).slice(0, 200)}`,
    );
  }
  const json = (await respuesta.json()) as { access_token: string; expires_in: number };
  cache = { email: cred.client_email, token: json.access_token, venceEn: ahora + json.expires_in };
  return json.access_token;
}
