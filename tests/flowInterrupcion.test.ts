import { describe, expect, it } from "vitest";
import { esInterrupcion } from "../src/core/flows/detectarInterrupcion.js";

const ETIQUETAS_MENU = ["🏠 Propiedades", "📄 Contratos", "💰 Pagos", "➕ Nueva carga", "📊 Resumen"];

describe("esInterrupcion", () => {
  it("detecta preguntas en lenguaje natural", () => {
    expect(esInterrupcion("¿Qué contratos vencen este mes?")).toBe(true);
    expect(esInterrupcion("Mostrame mis propiedades por favor, ¿cuáles hay?")).toBe(true);
  });

  it("detecta frases que empiezan con palabra interrogativa aunque no tengan signo de pregunta", () => {
    expect(esInterrupcion("cuanto tengo que cobrar este mes")).toBe(true);
    expect(esInterrupcion("quien es garante de Juan")).toBe(true);
  });

  it("detecta comandos", () => {
    expect(esInterrupcion("/reset")).toBe(true);
  });

  it("detecta cancelación explícita", () => {
    expect(esInterrupcion("cancelar")).toBe(true);
    expect(esInterrupcion("olvidalo")).toBe(true);
  });

  it("detecta una etiqueta del menú principal", () => {
    expect(esInterrupcion("🏠 Propiedades", ETIQUETAS_MENU)).toBe(true);
  });

  it("NO detecta una fecha mal formateada como interrupción", () => {
    expect(esInterrupcion("32/13/2026")).toBe(false);
  });

  it("NO detecta un nombre o dirección como interrupción", () => {
    expect(esInterrupcion("Juan Pérez")).toBe(false);
    expect(esInterrupcion("Av. Rivadavia 1540")).toBe(false);
  });

  it("NO detecta un monto como interrupción", () => {
    expect(esInterrupcion("850000")).toBe(false);
  });

  it("no rompe con texto vacío", () => {
    expect(esInterrupcion("")).toBe(false);
    expect(esInterrupcion("   ")).toBe(false);
  });
});
