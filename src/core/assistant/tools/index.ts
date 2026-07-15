import { buscarPersonaTool } from "./buscarPersona.tool.js";
import { buscarPropiedadTool } from "./buscarPropiedad.tool.js";
import { crearContratoTool } from "./crearContrato.tool.js";
import { crearPersonaTool } from "./crearPersona.tool.js";
import { crearPropiedadTool } from "./crearPropiedad.tool.js";
import { crearReciboTool } from "./crearRecibo.tool.js";
import { listarVencimientosTool } from "./listarVencimientos.tool.js";
import { obtenerEstadoPagoTool } from "./obtenerEstadoPago.tool.js";

export const tools = [
  buscarPropiedadTool,
  buscarPersonaTool,
  obtenerEstadoPagoTool,
  listarVencimientosTool,
  crearPersonaTool,
  crearPropiedadTool,
  crearContratoTool,
  crearReciboTool,
];
