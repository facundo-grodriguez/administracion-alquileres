import { describe, expect, it } from "vitest";
import {
  filtrarServicios,
  textoDelMes,
  type VencimientoServicio,
} from "../src/core/services/serviciosVencimiento.service.js";

const base = { propiedadId: null, gastoId: null, diaVencimiento: 1, periodo: "2026-11", diasRestantes: 0 };
const item = (v: Partial<VencimientoServicio>): VencimientoServicio =>
  ({
    ...base,
    servicioId: "x",
    nombre: "Luz",
    propiedad: null,
    fechaVencimiento: "2026-11-10",
    fechaPago: null,
    monto: null,
    ...(v.propiedad ? { propiedadId: "p1" } : {}),
    ...v,
  }) as VencimientoServicio;

describe("Servicios del mes: pendientes y pagados por separado", () => {
  const items = [
    item({ nombre: "Monotributo", fechaVencimiento: "2026-11-05", fechaPago: "2026-11-03", monto: "45000" }),
    item({ nombre: "Luz", propiedad: "Cerrito 4070", fechaVencimiento: "2026-11-28", monto: "20000" }),
    item({ nombre: "Celular", fechaVencimiento: "2026-11-12", fechaPago: "2026-11-01", monto: "15000" }),
    item({ nombre: "Gas", fechaVencimiento: "2026-11-15" }),
  ];

  it("lo que falta pagar va arriba y lo pagado abajo, sin mezclarse", () => {
    const texto = textoDelMes(items, "2026-11", "2026-11-06");
    console.log(`\n${texto}\n`);
    const lineas = texto.split("\n");
    const iPend = lineas.findIndex((l) => l.startsWith("🕓 Falta pagar (2)"));
    const iPag = lineas.findIndex((l) => l.startsWith("✅ Pagados (2)"));
    expect(iPend).toBeGreaterThan(0);
    expect(iPag).toBeGreaterThan(iPend);
    const pendientes = lineas.slice(iPend + 1, iPag).filter((l) => l.startsWith("•"));
    const pagados = lineas.slice(iPag + 1);
    expect(pendientes.every((l) => !l.includes("pagado"))).toBe(true);
    expect(pendientes[0]).toContain("Gas"); // por fecha de vencimiento: el 15 antes que el 28
    // agrupados: primero lo personal, después cada propiedad, con su título
    const bloque = lineas.slice(iPend + 1, iPag - 1);
    expect(bloque).toEqual([
      "",
      "👤 Personal",
      expect.stringContaining("🔥 Gas — 15/11/2026"),
      "",
      expect.stringMatching(/^🏠 Cerrito 4070 — aprox\. \$\s20\.000$/),
      expect.stringContaining("⚡ Luz — 28/11/2026"),
    ]);
    expect(lineas[iPag]).toMatch(/^✅ Pagados \(2\) — total \$\s60\.000$/);
    expect(pagados[0]).toBe("");
    expect(pagados[1]).toMatch(/^👤 Personal — \$\s60\.000$/);
    expect(pagados[2]).toContain("Celular"); // pagados por fecha de pago
    expect(pagados[3]).toMatch(/Monotributo — \$\s45\.000 — el 03\/11\/2026/);
    expect(texto).toMatch(/aprox\. \$\s20\.000/);
  });

  it("filtra personal o propiedades y lo dice en el título", () => {
    const personal = filtrarServicios(items, "personal");
    expect(personal.every((v) => !v.propiedadId)).toBe(true);
    const texto = textoDelMes(personal, "2026-11", "2026-11-06", "personal");
    expect(texto.split("\n")[0]).toBe("📅 Servicios de Noviembre 2026 — 👤 Personal");
    expect(texto).not.toContain("Cerrito");
    expect(textoDelMes([], "2026-11", "2026-11-06", "propiedades")).toContain("No hay servicios de propiedades");
  });

  it("todo pagado, y mes pasado con algo sin pagar", () => {
    expect(textoDelMes([items[0]!], "2026-11", "2026-11-06")).toContain("✅ Todo pagado este mes.");
    expect(textoDelMes([items[3]!], "2026-10", "2026-11-06")).toContain("🕓 Quedó sin pagar (1)");
  });
});
