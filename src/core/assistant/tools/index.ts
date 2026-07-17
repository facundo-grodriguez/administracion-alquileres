// Modelo simplificado (etapa 7): reparaciones, proveedores y documentación quedan deshabilitados
// (el código sigue existiendo en el repo, solo no se registran acá) para minimizar la cantidad
// de módulos que el usuario tiene que aprender a usar por chat.
import { actualizarAlquilerTool } from "./actualizarAlquiler.tool.js";
import { buscarPersonaTool } from "./buscarPersona.tool.js";
import { buscarPropiedadTool } from "./buscarPropiedad.tool.js";
import { cargarSeguroFinaerTool } from "./cargarSeguroFinaer.tool.js";
import { consultarGarantesTool } from "./consultarGarantes.tool.js";
import { crearContratoTool } from "./crearContrato.tool.js";
import { crearGastoTool } from "./crearGasto.tool.js";
import { crearMovimientoFinancieroTool } from "./crearMovimientoFinanciero.tool.js";
import { crearPersonaTool } from "./crearPersona.tool.js";
import { crearPropiedadTool } from "./crearPropiedad.tool.js";
import { crearReciboTool } from "./crearRecibo.tool.js";
import { listarGastosTool } from "./listarGastos.tool.js";
import { listarVencimientosTool } from "./listarVencimientos.tool.js";
import { marcarGastoPagadoTool } from "./marcarGastoPagado.tool.js";
import { obtenerAgendaTool } from "./obtenerAgenda.tool.js";
import { obtenerBalanceFinancieroTool } from "./obtenerBalanceFinanciero.tool.js";
import { obtenerEstadoPagoTool } from "./obtenerEstadoPago.tool.js";

export const tools = [
  // Consultas
  buscarPropiedadTool,
  buscarPersonaTool,
  obtenerEstadoPagoTool,
  obtenerAgendaTool,
  listarVencimientosTool,
  listarGastosTool,
  obtenerBalanceFinancieroTool,
  consultarGarantesTool,
  // Altas
  crearPersonaTool,
  crearPropiedadTool,
  crearContratoTool,
  crearReciboTool,
  crearGastoTool,
  crearMovimientoFinancieroTool,
  // Actualizaciones
  marcarGastoPagadoTool,
  actualizarAlquilerTool,
  cargarSeguroFinaerTool,
];
