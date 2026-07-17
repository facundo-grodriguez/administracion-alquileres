import type { ContextoTeclado } from "../assistant/tools/sugerirBotones.tool.js";

/**
 * Flujos guiados por botones (etapa 9): recolectan paso a paso los mismos campos que ya
 * definen las tools de alta (`inputSchema`), y al terminar llaman al `run()` de esa tool tal
 * cual — nunca duplican lógica de negocio ni de formato, nunca pasan por OpenAI.
 */
export type FlowId =
  | "crear_persona"
  | "crear_propiedad"
  | "crear_contrato"
  | "crear_recibo"
  | "crear_gasto"
  | "cargar_seguro_finaer";

export type DatosFlujo = Record<string, unknown>;

export type OpcionCampo = { valor: string; etiqueta: string };
export type CandidatoFlujo = { id: string; etiqueta: string };

export type CampoFlujo =
  | { tipo: "texto"; opcional?: boolean }
  | { tipo: "numero"; opcional?: boolean; min?: number; max?: number }
  | { tipo: "monto"; opcional?: boolean }
  | { tipo: "fecha"; opcional?: boolean; permitirHoy?: boolean }
  | { tipo: "periodo"; opcional?: boolean }
  | { tipo: "opciones"; opciones: OpcionCampo[] }
  | {
      tipo: "entidad";
      buscar: (query: string) => Promise<CandidatoFlujo[]>;
      crear?: FlowId;
      /** Datos a precargar en el sub-flujo de alta inline (ej. el rol, para no volver a preguntarlo). */
      datosCrear?: DatosFlujo;
      /** Etiqueta del botón "➕ Crear ...", en vez del genérico "➕ Crear nuevo". */
      etiquetaCrear?: string;
    }
  | { tipo: "confirmacion" };

export type PasoFlujo = {
  /** Coincide con el nombre del campo en el `inputSchema` de la tool destino. */
  id: string;
  pregunta: (datos: DatosFlujo) => string;
  campo: CampoFlujo;
  /** Paso condicional (ej. datos de Finaer solo si el paso anterior fue "sí"). */
  saltar?: (datos: DatosFlujo) => boolean;
};

export type DefinicionFlujo = {
  id: FlowId;
  /** Para el botón de "Nueva carga" y mensajes genéricos. */
  titulo: string;
  /** Etiqueta en lenguaje de negocio para cuando este flujo se usa como sub-flujo (ej. "Juan Pérez"). */
  etiqueta: (datos: DatosFlujo) => string;
  /** El último paso siempre debe ser `{ campo: { tipo: "confirmacion" } }`. */
  pasos: PasoFlujo[];
  /** Llama al `run()` de la tool correspondiente — nunca reimplementa la persistencia. */
  ejecutar: (datos: DatosFlujo) => Promise<string>;
  botonesPostAccion?: ContextoTeclado;
};

export type FlowFrame = {
  flowId: FlowId;
  pasoActual: number;
  datos: DatosFlujo;
  /** Candidatos mostrados en el último paso "entidad" de este frame (para resolver flujo:sel:<idx>). */
  candidatosPendientes?: CandidatoFlujo[];
  /** Si este frame es un sub-flujo (alta inline), el id del campo del padre a completar al terminar. */
  campoDestino?: string;
};

export type FlowState = {
  pila: FlowFrame[];
};

export function crearEstadoFlujo(): FlowState {
  return { pila: [] };
}

export type ResultadoFlujo =
  | { tipo: "pregunta"; texto: string; campo: CampoFlujo }
  | {
      tipo: "candidatos";
      texto: string;
      candidatos: CandidatoFlujo[];
      permiteCrear?: FlowId;
      etiquetaCrear?: string;
      /** true = resultado de una búsqueda que escribió el usuario; ausente/false = listado inicial de existentes. */
      esBusqueda?: boolean;
    }
  | { tipo: "reprompt"; texto: string; campo: CampoFlujo }
  | { tipo: "interrumpido"; textoOriginal: string }
  | { tipo: "completado"; texto: string; botonesPostAccion?: ContextoTeclado }
  | { tipo: "cancelado"; texto: string }
  | { tipo: "confirmar_cancelacion"; texto: string }
  | { tipo: "sin_flujo" };

/** Clave donde se guarda la etiqueta en lenguaje de negocio de un campo "entidad" ya resuelto. */
export function etiquetaKey(campoId: string): string {
  return `${campoId}__label`;
}
