import { describe, expect, it } from "vitest";
import { textoConEleccion } from "../src/interfaces/telegram/util.js";

describe("textoConEleccion", () => {
  it("agrega la opción elegida debajo del mensaje", () => {
    expect(textoConEleccion("¿De qué propiedad?", "Cerrito 4070")).toBe("¿De qué propiedad?\n\n👉 Cerrito 4070");
  });
  it("recorta mensajes largos para no pasar el límite de Telegram", () => {
    const largo = "x".repeat(5000);
    expect(textoConEleccion(largo, "Sí").length).toBeLessThanOrEqual(4096);
  });
});
