import { buscarPersonaTool } from "./buscarPersona.tool.js";
import { buscarPropiedadTool } from "./buscarPropiedad.tool.js";
import { crearContratoTool } from "./crearContrato.tool.js";
import { crearImpuestoServicioTool } from "./crearImpuestoServicio.tool.js";
import { crearPersonaTool } from "./crearPersona.tool.js";
import { crearPropiedadTool } from "./crearPropiedad.tool.js";
import { crearReciboTool } from "./crearRecibo.tool.js";
import { crearReparacionTool } from "./crearReparacion.tool.js";
import { crearSeguroTool } from "./crearSeguro.tool.js";
import { listarReparacionesTool } from "./listarReparaciones.tool.js";
import { listarVencimientosTool } from "./listarVencimientos.tool.js";
import { marcarReparacionCompletadaTool } from "./marcarReparacionCompletada.tool.js";
import { obtenerAgendaTool } from "./obtenerAgenda.tool.js";
import { obtenerEstadoPagoTool } from "./obtenerEstadoPago.tool.js";

export const tools = [
  // Consultas
  buscarPropiedadTool,
  buscarPersonaTool,
  obtenerEstadoPagoTool,
  obtenerAgendaTool,
  listarVencimientosTool,
  listarReparacionesTool,
  // Altas
  crearPersonaTool,
  crearPropiedadTool,
  crearContratoTool,
  crearReciboTool,
  crearSeguroTool,
  crearImpuestoServicioTool,
  crearReparacionTool,
  // Actualizaciones
  marcarReparacionCompletadaTool,
];
