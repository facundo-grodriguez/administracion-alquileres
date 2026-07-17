import type { DefinicionFlujo, FlowId } from "../types.js";
import { cargarSeguroFinaerFlow } from "./cargarSeguroFinaer.flow.js";
import { crearContratoFlow } from "./crearContrato.flow.js";
import { crearGastoFlow } from "./crearGasto.flow.js";
import { crearPersonaFlow } from "./crearPersona.flow.js";
import { crearPropiedadFlow } from "./crearPropiedad.flow.js";
import { crearReciboFlow } from "./crearRecibo.flow.js";

export const FLUJOS: Record<FlowId, DefinicionFlujo> = {
  crear_persona: crearPersonaFlow,
  crear_propiedad: crearPropiedadFlow,
  crear_contrato: crearContratoFlow,
  crear_recibo: crearReciboFlow,
  crear_gasto: crearGastoFlow,
  cargar_seguro_finaer: cargarSeguroFinaerFlow,
};

/** Los 6 flujos que se ofrecen como accesos directos desde "➕ Nueva carga". */
export const FLUJOS_MENU_PRINCIPAL: FlowId[] = [
  "crear_persona",
  "crear_propiedad",
  "crear_contrato",
  "crear_recibo",
  "crear_gasto",
  "cargar_seguro_finaer",
];
