import { describe, expect, it } from "vitest";
import { parsearListaCuentas } from "../src/core/util/listaCuentas.js";

describe("parsearListaCuentas (/cuentas, sin IA)", () => {
  it("lee la lista como la planilla, un rubro por línea", () => {
    const items = parsearListaCuentas(
      [
        "Armá mis cuentas personales. Los montos son lo que reservo por mes:",
        "- Sueldo 1020935 (ingreso)",
        "- Compras $ 250.000",
        "- Seguro 110000 (vinculado al vencimiento Seguro auto)",
        "- Placard 31000 (sin vincular)",
        "- Gp 1/3 225285 (vencimiento Moto GP)",
        "- Lu regalo 45900",
      ].join("\n"),
    );
    expect(items).toEqual([
      {
        tipo: "rubro",
        nombre: "Sueldo",
        previsto: "1020935",
        ingreso: true,
        vencimiento: undefined,
        desvincular: false,
      },
      {
        tipo: "rubro",
        nombre: "Compras",
        previsto: "250000",
        ingreso: false,
        vencimiento: undefined,
        desvincular: false,
      },
      {
        tipo: "rubro",
        nombre: "Seguro",
        previsto: "110000",
        ingreso: false,
        vencimiento: "Seguro auto",
        desvincular: false,
      },
      {
        tipo: "rubro",
        nombre: "Placard",
        previsto: "31000",
        ingreso: false,
        vencimiento: undefined,
        desvincular: true,
      },
      {
        tipo: "rubro",
        nombre: "Gp 1/3",
        previsto: "225285",
        ingreso: false,
        vencimiento: "Moto GP",
        desvincular: false,
      },
      {
        tipo: "rubro",
        nombre: "Lu regalo",
        previsto: "45900",
        ingreso: false,
        vencimiento: undefined,
        desvincular: false,
      },
    ]);
  });

  it("también separada por comas, con quitar y errores", () => {
    const items = parsearListaCuentas("armá mis cuentas: compras 250000, nafta 100.000,50, quitar salidas, extra");
    expect(
      items.map((i) =>
        i.tipo === "rubro" ? `${i.nombre}=${i.previsto}` : `${i.tipo}:${"nombre" in i ? i.nombre : i.texto}`,
      ),
    ).toEqual(["compras=250000", "nafta=100000.50", "quitar:salidas", "error:extra"]);
  });

  it("deja en el nombre otros paréntesis", () => {
    const [item] = parsearListaCuentas("Gp (cuota 1/3) 225285");
    expect(item).toMatchObject({ tipo: "rubro", nombre: "Gp (cuota 1/3)" });
  });
});
