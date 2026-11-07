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
    "Lo reservado de cada rubro ya cuenta como gastado; esto lo modifica solo para un mes cuando fue distinto: " +
    "modo 'total' (lo que fue ese mes: 'este mes en compras gasté 230000', 'cobré 1050000 de sueldo'), 'sumar' (se " +
    "agrega a lo que cuenta ese mes: 'sumá 15000 a nafta') o 'previsto' (otra reserva solo para ese mes: 'en " +
    "diciembre reservo 300000 para compras').",
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
    return [
      `Listo: ${r.rubro} de ${formatoPeriodoAR(r.periodo)} — ${formatoARS(String(r.linea.monto))}.`,
      `🧾 Gastos del mes: ${formatoARS(String(t.gastos))}.`,
      r.cuentas.ingresos.length > 0 ? `💰 Sobra: ${formatoARS(String(t.sobra))}.` : null,
    ]
      .filter(Boolean)
      .join("\n");
  },
});

export const verCuentasTool = defineTool({
  name: "ver_cuentas",
  description:
    "Muestra las cuentas personales de un mes: sueldo, gastos (lo reservado o lo modificado), cuánto sobra y " +
    "cada rubro. Usar para '¿cómo vengo este mes?', '¿cuánto me sobra?', 'mis cuentas'.",
  inputSchema: z.object({ periodo }),
  run: async (input) => cuentas.textoCuentas(await cuentas.cuentasDelMes(input.periodo)),
});
