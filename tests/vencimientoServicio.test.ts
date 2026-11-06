import { describe, expect, it } from "vitest";
import {
  avisoQueCorresponde,
  correspondeAlPeriodo,
  cuandoVence,
  existiaEnPeriodo,
  fechaDelPeriodo,
  iconoServicio,
  nombreServicio,
  periodoAnterior,
  periodoPendiente,
  periodoSiguiente,
  tipoGastoDeServicio,
  ultimoMesAlDarDeBaja,
  vencimientoDelMes,
} from "../src/core/util/vencimientoServicio.js";

const nada = { previo: false, dia: false };

describe("fechas de vencimiento de servicios", () => {
  it("usa el día fijo, o el último día si el mes es más corto", () => {
    expect(fechaDelPeriodo(15, "2026-11")).toBe("2026-11-15");
    expect(fechaDelPeriodo(31, "2026-11")).toBe("2026-11-30");
    expect(fechaDelPeriodo(30, "2027-02")).toBe("2027-02-28");
    expect(fechaDelPeriodo(29, "2028-02")).toBe("2028-02-29");
    expect(fechaDelPeriodo(1, "2026-12")).toBe("2026-12-01");
  });

  it("si ese mes se cambió la fecha, manda la fecha cambiada", () => {
    expect(vencimientoDelMes(15, "2026-11")).toBe("2026-11-15");
    expect(vencimientoDelMes(15, "2026-11", { fechaVencimiento: "2026-11-18" })).toBe("2026-11-18");
    expect(vencimientoDelMes(15, "2026-11", { fechaVencimiento: null, fechaPago: "2026-11-10" })).toBe("2026-11-15");
  });

  it("mes siguiente, con cambio de año", () => {
    expect(periodoSiguiente("2026-11")).toBe("2026-12");
    expect(periodoSiguiente("2026-12")).toBe("2027-01");
  });

  it("el pendiente es el de este mes si no se pagó, si no el del que viene", () => {
    expect(periodoPendiente("2026-11-20", () => false)).toBe("2026-11");
    expect(periodoPendiente("2026-11-20", (p) => p === "2026-11")).toBe("2026-12");
    expect(periodoPendiente("2026-12-05", (p) => p === "2026-12")).toBe("2027-01");
  });
});

describe("avisoQueCorresponde", () => {
  it("avisa 3, 2 o 1 día antes con el aviso previo (una sola vez)", () => {
    expect(avisoQueCorresponde("2026-11-12", "2026-11-15", nada)).toBe("previo");
    expect(avisoQueCorresponde("2026-11-14", "2026-11-15", nada)).toBe("previo");
    expect(avisoQueCorresponde("2026-11-13", "2026-11-15", { previo: true, dia: false })).toBeUndefined();
  });

  it("no avisa antes de tiempo", () => {
    expect(avisoQueCorresponde("2026-11-11", "2026-11-15", nada)).toBeUndefined();
    expect(avisoQueCorresponde("2026-10-30", "2026-11-15", nada)).toBeUndefined();
  });

  it("el día del vencimiento manda el aviso del día, aunque ya haya mandado el previo", () => {
    expect(avisoQueCorresponde("2026-11-15", "2026-11-15", { previo: true, dia: false })).toBe("dia");
    expect(avisoQueCorresponde("2026-11-15", "2026-11-15", { previo: true, dia: true })).toBeUndefined();
  });

  it("si el bot no pudo avisar ese día, avisa hasta 2 días después; después no insiste", () => {
    expect(avisoQueCorresponde("2026-11-16", "2026-11-15", nada)).toBe("dia");
    expect(avisoQueCorresponde("2026-11-17", "2026-11-15", nada)).toBe("dia");
    expect(avisoQueCorresponde("2026-11-18", "2026-11-15", nada)).toBeUndefined();
  });

  it("funciona en el cambio de mes (vence el 2 del mes que viene)", () => {
    expect(avisoQueCorresponde("2026-11-30", "2026-12-02", nada)).toBe("previo");
  });
});

describe("textos de servicios", () => {
  it("cuánto falta", () => {
    expect(cuandoVence("2026-11-15", "2026-11-15")).toBe("vence hoy");
    expect(cuandoVence("2026-11-14", "2026-11-15")).toBe("vence mañana");
    expect(cuandoVence("2026-11-12", "2026-11-15")).toBe("vence en 3 días");
    expect(cuandoVence("2026-11-16", "2026-11-15")).toBe("venció ayer");
    expect(cuandoVence("2026-11-18", "2026-11-15")).toBe("venció hace 3 días");
  });

  it("nombre con ícono y de quién es", () => {
    expect(iconoServicio("Luz")).toBe("⚡");
    expect(iconoServicio("celular")).toBe("📱");
    expect(iconoServicio("Gimnasio")).toBe("📌");
    expect(nombreServicio("Luz")).toBe("⚡ Luz (Personal)");
    expect(nombreServicio("Gas", "Cerrito 4070")).toBe("🔥 Gas (Cerrito 4070)");
  });
});

describe("rubro del gasto al pagar un servicio de propiedad", () => {
  it("los servicios conocidos van a su rubro y el resto a 'otro'", () => {
    expect(tipoGastoDeServicio("Luz")).toBe("luz");
    expect(tipoGastoDeServicio(" expensas ")).toBe("expensas");
    expect(tipoGastoDeServicio("ABL")).toBe("ABL");
    expect(tipoGastoDeServicio("arba")).toBe("ARBA");
    expect(tipoGastoDeServicio("Seguro")).toBe("seguro_hogar");
    expect(tipoGastoDeServicio("Alarma")).toBe("otro");
    expect(tipoGastoDeServicio("Celular")).toBe("otro");
  });
});

describe("ver meses anteriores", () => {
  it("mes anterior, cruzando el año", () => {
    expect(periodoAnterior("2026-11")).toBe("2026-10");
    expect(periodoAnterior("2027-01")).toBe("2026-12");
  });

  it("un servicio cargado este mes no aparece en los anteriores, salvo que tenga algo de ese mes", () => {
    const creado = new Date(2026, 10, 2); // 2/11/2026
    expect(existiaEnPeriodo(creado, "2026-11", false)).toBe(true);
    expect(existiaEnPeriodo(creado, "2026-12", false)).toBe(true);
    expect(existiaEnPeriodo(creado, "2026-10", false)).toBe(false);
    expect(existiaEnPeriodo(creado, "2026-10", true)).toBe(true);
  });
});

describe("último mes de un servicio (v9.11.0)", () => {
  const creado = new Date(2026, 8, 10); // septiembre 2026
  it("con última cuota no cuenta después de ese mes", () => {
    const s = { createdAt: creado, activo: true, hastaPeriodo: "2026-12" };
    expect(correspondeAlPeriodo(s, "2026-12", false)).toBe(true);
    expect(correspondeAlPeriodo(s, "2027-01", false)).toBe(false);
    expect(correspondeAlPeriodo(s, "2026-08", false)).toBe(false); // antes de cargarlo
  });
  it("dado de baja: sigue contando hasta su último mes, aunque no esté pagado", () => {
    const s = { createdAt: creado, activo: false, hastaPeriodo: "2026-10" };
    expect(correspondeAlPeriodo(s, "2026-09", false)).toBe(true);
    expect(correspondeAlPeriodo(s, "2026-11", true)).toBe(false);
  });
  it("dados de baja antes de v9.11.0: solo los meses con algo cargado", () => {
    const s = { createdAt: creado, activo: false, hastaPeriodo: null };
    expect(correspondeAlPeriodo(s, "2026-10", true)).toBe(true);
    expect(correspondeAlPeriodo(s, "2026-11", false)).toBe(false);
  });
  it("al dar de baja queda este mes si ya se pagó, si no el anterior", () => {
    expect(ultimoMesAlDarDeBaja("2026-11-06", true, null)).toBe("2026-11");
    expect(ultimoMesAlDarDeBaja("2026-11-06", false, null)).toBe("2026-10");
    expect(ultimoMesAlDarDeBaja("2027-01-06", false, null)).toBe("2026-12");
    expect(ultimoMesAlDarDeBaja("2027-03-06", true, "2026-12")).toBe("2026-12"); // ya había terminado
  });
});
