// Tools de las cuentas personales (v9.13.0): armar el presupuesto, cargar lo del mes y verlo.
import { z } from "zod";
import * as cuentas from "../../services/cuentas.service.js";
import { formatoPeriodoAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

const periodo = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .optional()
  .describe("Mes YYYY-MM. Por defecto, el actual.");

export const configurarCuentaTool = defineTool({
  name: "configurar_cuenta",
  description:
    "Arma o cambia las cuentas personales del administrador (su presupuesto del mes, aparte de las propiedades): " +
    "un rubro con su monto previsto por mes (Compras, Nafta, Salidas, Seguro, Sueldo...). Llamar una vez por rubro; " +
    "si manda una lista ('armá mis cuentas: compras 250000, nafta 100000, sueldo 1020935'), una llamada por cada uno. " +
    "El sueldo u otros cobros van con tipo 'ingreso'. La reserva y los vencimientos van por separado: pasá " +
    "vencimiento (nombre de un vencimiento personal, ej 'Moto GP') solo si el usuario pide vincularlo, y así lo real " +
    "es lo pagado ahí; desvincular: true lo separa. quitar: true lo saca.",
  inputSchema: z.object({
    nombre: z.string().describe("Ej: Compras, Nafta, Sueldo, Gp 1/3"),
    tipo: z.enum(["gasto", "ingreso"]).optional(),
    previsto: z.string().optional().describe("Monto previsto por mes, ej '250000'"),
    vencimiento: z
      .string()
      .optional()
      .describe("Solo si pide vincularlo: nombre del vencimiento personal, ej 'Moto GP'"),
    desvincular: z.boolean().optional(),
    quitar: z.boolean().optional(),
  }),
  run: async (input) => {
    const r = await cuentas.configurarRubro(input);
    if (!r) return `No encontré el rubro ${input.nombre} en tus cuentas.`;
    return cuentas.textoConfigurar(r);
  },
});

export const cargarCuentaTool = defineTool({
  name: "cargar_cuenta",
  description:
    "Carga en las cuentas personales lo de un mes de un rubro: modo 'total' (lo gastado ese mes, reemplaza lo que " +
    "había: 'este mes en compras gasté 230000', 'cobré 1020935 de sueldo'), 'sumar' (se agrega: 'sumá 15000 a " +
    "nafta') o 'previsto' (otro previsto solo para ese mes: 'en diciembre preveo 300000 de compras'). Los rubros " +
    "vinculados a un vencimiento toman solos lo pagado; no hace falta cargarlos.",
  inputSchema: z.object({
    rubro: z.string(),
    monto: z.string().describe("Ej '230000'"),
    modo: z.enum(["total", "sumar", "previsto"]).optional(),
    periodo,
  }),
  run: async (input) => {
    const r = await cuentas.cargar(input);
    if (!r) return `No tengo el rubro "${input.rubro}" en tus cuentas. ¿Lo agrego? (con configurar_cuenta)`;
    const t = r.cuentas.totales;
    const valor = r.modo === "previsto" ? r.linea.previsto : r.linea.real;
    return [
      `Listo: ${r.rubro} de ${formatoPeriodoAR(r.periodo)} — ${r.modo === "previsto" ? "previsto " : ""}${formatoARS(String(valor ?? 0))}.`,
      `✅ Gastado en el mes: ${formatoARS(String(t.gastado))} de ${formatoARS(String(t.previsto))} previstos.`,
      r.cuentas.ingresos.length > 0 ? `💰 Sobraría: ${formatoARS(String(t.sobraProyectada))}.` : null,
    ]
      .filter(Boolean)
      .join("\n");
  },
});

export const verCuentasTool = defineTool({
  name: "ver_cuentas",
  description:
    "Muestra las cuentas personales de un mes: sueldo, gastos previstos, cuánto sobra, lo gastado hasta ahora y " +
    "cada rubro. Usar para '¿cómo vengo este mes?', '¿cuánto me sobra?', 'mis cuentas'.",
  inputSchema: z.object({ periodo }),
  run: async (input) => cuentas.textoCuentas(await cuentas.cuentasDelMes(input.periodo)),
});
