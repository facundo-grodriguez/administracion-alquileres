import type { DefinicionFlujo, FlowId } from "../types.js";
import { cargarPagosAnterioresFlow } from "./cargarPagosAnteriores.flow.js";
import { cargarSeguroFinaerFlow } from "./cargarSeguroFinaer.flow.js";
import { crearContratoFlow } from "./crearContrato.flow.js";
import { crearGastoFlow } from "./crearGasto.flow.js";
import { crearPersonaFlow } from "./crearPersona.flow.js";
import { crearPropiedadFlow } from "./crearPropiedad.flow.js";
import { crearReciboFlow } from "./crearRecibo.flow.js";
import { editarPropiedadFlow } from "./editarPropiedad.flow.js";
import { corregirGastoFlow, pagarGastoFlow } from "./gastosFlujos.js";
import { registrarAlquilerActualFlow } from "./registrarAlquilerActual.flow.js";

export const FLUJOS: Record<FlowId, DefinicionFlujo> = {
  crear_persona: crearPersonaFlow,
  crear_propiedad: crearPropiedadFlow,
  crear_contrato: crearContratoFlow,
  crear_recibo: crearReciboFlow,
  crear_gasto: crearGastoFlow,
  cargar_seguro_finaer: cargarSeguroFinaerFlow,
  registrar_alquiler_actual: registrarAlquilerActualFlow,
  cargar_pagos_anteriores: cargarPagosAnterioresFlow,
  pagar_gasto: pagarGastoFlow,
  corregir_gasto: corregirGastoFlow,
  editar_propiedad: editarPropiedadFlow,
};

/** Los flujos que se ofrecen como accesos directos desde "➕ Nueva carga" (altas). */
export const FLUJOS_MENU_PRINCIPAL: FlowId[] = [
  "crear_persona",
  "crear_propiedad",
  "crear_contrato",
  "crear_recibo",
  "cargar_pagos_anteriores",
  "crear_gasto",
  "pagar_gasto",
  "cargar_seguro_finaer",
];

/** Los flujos de "✏️ Modificar": corregir lo que ya está cargado. */
export const FLUJOS_MODIFICAR: { flowId: FlowId; titulo: string }[] = [
  { flowId: "editar_propiedad", titulo: "🏠 Propiedad" },
  { flowId: "crear_recibo", titulo: "💰 Pago de alquiler" },
  { flowId: "corregir_gasto", titulo: "💡 Gasto" },
  { flowId: "registrar_alquiler_actual", titulo: "⚡ Alquiler actual" },
];
