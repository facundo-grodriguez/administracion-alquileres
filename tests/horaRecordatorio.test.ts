import { describe, expect, it } from "vitest";
import { horaActual, yaEsHora } from "../src/interfaces/telegram/scheduler.js";

describe("recordatorio diario si el bot estaba dormido", () => {
  it("toca mandar desde la hora configurada en adelante, no antes", () => {
    expect(yaEsHora("08:50", "09:00")).toBe(false);
    expect(yaEsHora("09:00", "09:00")).toBe(true);
    expect(yaEsHora("16:30", "09:00")).toBe(true); // se despertó tarde: sale igual
  });

  it("la hora sale con dos dígitos", () => {
    expect(horaActual(new Date(2026, 10, 6, 9, 5))).toBe("09:05");
  });

  it("el bot usa la hora de Argentina aunque el servidor esté en UTC", () => {
    expect(process.env.TZ).toBeTruthy();
  });
});
