import { describe, expect, it } from "vitest";
import { tituloVersion } from "../src/interfaces/telegram/avisoVersion.js";

const CHANGELOG = [
  "# Changelog",
  "",
  "## [9.3.0] — 2026-10-21 — Aviso automático de versión nueva",
  "Texto.",
  "## [9.2.1] — 2026-10-18 — Botón de alquiler actual en Vencimientos",
].join("\n");

describe("tituloVersion", () => {
  it("devuelve el título de la versión pedida", () => {
    expect(tituloVersion(CHANGELOG, "9.3.0")).toBe("Aviso automático de versión nueva");
    expect(tituloVersion(CHANGELOG, "9.2.1")).toBe("Botón de alquiler actual en Vencimientos");
  });
  it("devuelve undefined si la versión no está en el changelog", () => {
    expect(tituloVersion(CHANGELOG, "1.0.0")).toBeUndefined();
  });
});
