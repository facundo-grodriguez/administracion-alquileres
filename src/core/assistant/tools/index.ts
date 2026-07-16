import { adjuntarComprobanteReparacionTool } from "./adjuntarComprobanteReparacion.tool.js";
import { buscarDocumentosTool } from "./buscarDocumentos.tool.js";
import { buscarPersonaTool } from "./buscarPersona.tool.js";
import { buscarPropiedadTool } from "./buscarPropiedad.tool.js";
import { buscarProveedorTool } from "./buscarProveedor.tool.js";
import { consultarGarantesTool } from "./consultarGarantes.tool.js";
import { crearContratoTool } from "./crearContrato.tool.js";
import { crearDocumentoTool } from "./crearDocumento.tool.js";
import { crearImpuestoServicioTool } from "./crearImpuestoServicio.tool.js";
import { crearMovimientoFinancieroTool } from "./crearMovimientoFinanciero.tool.js";
import { crearPersonaTool } from "./crearPersona.tool.js";
import { crearPropiedadTool } from "./crearPropiedad.tool.js";
import { crearProveedorTool } from "./crearProveedor.tool.js";
import { crearReciboTool } from "./crearRecibo.tool.js";
import { crearReparacionTool } from "./crearReparacion.tool.js";
import { crearSeguroTool } from "./crearSeguro.tool.js";
import { listarImpuestosServiciosTool } from "./listarImpuestosServicios.tool.js";
import { listarReparacionesTool } from "./listarReparaciones.tool.js";
import { listarSegurosTool } from "./listarSeguros.tool.js";
import { listarVencimientosTool } from "./listarVencimientos.tool.js";
import { marcarImpuestoServicioPagadoTool } from "./marcarImpuestoServicioPagado.tool.js";
import { marcarReparacionCompletadaTool } from "./marcarReparacionCompletada.tool.js";
import { marcarSeguroPagadoTool } from "./marcarSeguroPagado.tool.js";
import { obtenerAgendaTool } from "./obtenerAgenda.tool.js";
import { obtenerBalanceFinancieroTool } from "./obtenerBalanceFinanciero.tool.js";
import { obtenerEstadoPagoTool } from "./obtenerEstadoPago.tool.js";
import { vincularCarpetaDriveTool } from "./vincularCarpetaDrive.tool.js";

export const tools = [
  // Consultas
  buscarPropiedadTool,
  buscarPersonaTool,
  obtenerEstadoPagoTool,
  obtenerAgendaTool,
  listarVencimientosTool,
  listarReparacionesTool,
  buscarProveedorTool,
  buscarDocumentosTool,
  listarImpuestosServiciosTool,
  listarSegurosTool,
  obtenerBalanceFinancieroTool,
  consultarGarantesTool,
  // Altas
  crearPersonaTool,
  crearPropiedadTool,
  crearContratoTool,
  crearReciboTool,
  crearSeguroTool,
  crearImpuestoServicioTool,
  crearReparacionTool,
  crearProveedorTool,
  crearDocumentoTool,
  crearMovimientoFinancieroTool,
  // Actualizaciones
  marcarReparacionCompletadaTool,
  vincularCarpetaDriveTool,
  adjuntarComprobanteReparacionTool,
  marcarSeguroPagadoTool,
  marcarImpuestoServicioPagadoTool,
];
