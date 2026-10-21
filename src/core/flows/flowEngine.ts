import { FLUJOS } from "./definiciones/index.js";
import { esInterrupcion } from "./detectarInterrupcion.js";
import type {
  CampoFlujo,
  CandidatoFlujo,
  DatosFlujo,
  DefinicionFlujo,
  FlowFrame,
  FlowId,
  FlowState,
  PasoFlujo,
  ReferenciaEntidad,
  ResultadoFlujo,
} from "./types.js";
import { etiquetaKey } from "./types.js";
import { parseFechaUsuario, parseMontoUsuario, parseNumeroUsuario, parsePeriodoUsuario } from "./validadores.js";

/** Tope de resultados al buscar por texto (el usuario ya escribió algo, se puede acotar más). */
const MAX_CANDIDATOS_BUSQUEDA = 5;
/** Tope del listado inicial de existentes al entrar a un paso "entidad" (antes de escribir nada). */
const MAX_CANDIDATOS_LISTADO = 8;

const TEXTO_CONFIRMAR_CANCELACION =
  "¿Estás seguro de que querés cancelar esta carga? Se va a perder todo lo que cargaste hasta ahora.";

export const CALLBACK_CANCELAR = "cancelar";
export const CALLBACK_CANCELAR_CONFIRMADO = "cancelar_si";
export const CALLBACK_CONTINUAR = "continuar";
export const CALLBACK_CONFIRMAR = "confirmar";
export const CALLBACK_OMITIR = "omitir";
export const CALLBACK_HOY = "hoy";
export const CALLBACK_BUSCAR_DE_NUEVO = "buscar_de_nuevo";

/** Registro de flujos: por defecto los reales (`FLUJOS`), pero inyectable — así se puede testear
 * la mecánica genérica del motor (avance, saltos, sub-flujos, confirmación) con flujos de prueba
 * en memoria, sin tocar la base de datos. */
export type RegistroFlujos = Record<FlowId, DefinicionFlujo>;

function tope(estado: FlowState): FlowFrame | undefined {
  return estado.pila[estado.pila.length - 1];
}

function pasoActualDe(frame: FlowFrame, registro: RegistroFlujos): PasoFlujo | undefined {
  return registro[frame.flowId].pasos[frame.pasoActual];
}

export function flujoActivo(estado: FlowState): boolean {
  return estado.pila.length > 0;
}

/**
 * Marca del paso que se está mostrando ("<carga>.<nivel>.<paso>"): viaja en los botones para que cada
 * botón valga solo para la pregunta en la que apareció — un doble toque o un update que Telegram
 * reenvía no contesta por error la pregunta siguiente.
 */
export function marcaPasoActual(estado: FlowState): string | undefined {
  const frame = tope(estado);
  if (!frame) return undefined;
  return `${estado.carga ?? 0}.${estado.pila.length}.${frame.pasoActual}`;
}

export function cancelarFlujo(estado: FlowState): void {
  estado.pila.length = 0;
}

function renderPaso(frame: FlowFrame, paso: PasoFlujo): ResultadoFlujo {
  return { tipo: "pregunta", texto: paso.pregunta(frame.datos), campo: paso.campo };
}

function pistaFormato(campo: CampoFlujo): string {
  switch (campo.tipo) {
    case "fecha":
      return campo.permitirHoy
        ? 'No entendí la fecha. Escribila como DD/MM/AAAA (ej: 01/08/2026) o tocá "Hoy".'
        : "No entendí la fecha. Escribila como DD/MM/AAAA (ej: 01/08/2026).";
    case "monto":
      return "No entendí el monto. Escribilo en números (ej: 850000).";
    case "numero":
      return "No entendí el número. Escribilo en dígitos.";
    case "texto":
      return "Necesito una respuesta de texto.";
    case "periodo":
      return "No entendí el período. Escribilo como MM/AAAA (ej: 08/2026).";
    case "entidad":
      return "Escribí un nombre, DNI o dirección para buscar.";
    case "opciones":
    case "confirmacion":
      return "Usá los botones de abajo para responder.";
  }
}

/** Quita del texto cualquier línea que sea exactamente el marcador `(id: ...)` — pensado para que
 * la IA lo use internamente al encadenar tool calls, nunca para mostrárselo al usuario. El flujo
 * guiado no pasa por la IA, así que tiene que limpiarlo él mismo antes de mostrar el resultado. */
function limpiarMarcadorId(texto: string): string {
  return texto
    .split("\n")
    .filter((linea) => !/^\(id: [^)]+\)$/.test(linea.trim()))
    .join("\n")
    .trimEnd();
}

/** Recorre desde `frame.pasoActual` saltando los pasos condicionales, y renderiza el primero que
 * corresponde mostrar. Si es un paso "entidad" recién alcanzado, muestra de entrada el listado de
 * existentes (botones) en vez de esperar a que el usuario escriba algo para buscar. */
async function renderDesde(estado: FlowState, registro: RegistroFlujos): Promise<ResultadoFlujo> {
  const frame = tope(estado);
  if (!frame) return { tipo: "sin_flujo" };
  const definicion = registro[frame.flowId];

  while (frame.pasoActual < definicion.pasos.length) {
    const paso = definicion.pasos[frame.pasoActual]!;
    // Un paso ya completado de antemano (datos iniciales, ej. el contrato elegido desde un botón)
    // no se vuelve a preguntar. La confirmación final se muestra siempre.
    const yaCompleto = paso.campo.tipo !== "confirmacion" && frame.datos[paso.id] !== undefined;
    if (yaCompleto || paso.saltar?.(frame.datos)) {
      frame.pasoActual += 1;
      continue;
    }
    frame.candidatosPendientes = undefined;

    if (paso.campo.tipo === "entidad") {
      const candidatos = (await paso.campo.buscar("")).slice(0, MAX_CANDIDATOS_LISTADO);
      frame.candidatosPendientes = candidatos;
      return {
        tipo: "candidatos",
        texto: paso.pregunta(frame.datos),
        candidatos,
        permiteCrear: paso.campo.crear,
        etiquetaCrear: paso.campo.etiquetaCrear,
        esBusqueda: false,
      };
    }

    return renderPaso(frame, paso);
  }

  // No debería pasar: todo flujo termina en un paso "confirmacion" que se resuelve con
  // CALLBACK_CONFIRMAR antes de llegar acá. Fallback defensivo, no rompe la conversación.
  estado.pila.pop();
  return { tipo: "cancelado", texto: "No quedaba nada más por completar en este paso." };
}

/** Avanza al próximo paso (tras resolver el actual) y renderiza. Antes corre la validación del paso, si tiene. */
async function siguientePaso(estado: FlowState, registro: RegistroFlujos): Promise<ResultadoFlujo> {
  const frame = tope(estado);
  if (!frame) return { tipo: "sin_flujo" };
  const pasos = registro[frame.flowId].pasos;
  const aviso = await pasos[frame.pasoActual]?.validar?.(frame.datos);
  if (aviso) {
    const destino = aviso.volverA ? pasos.findIndex((p) => p.id === aviso.volverA) : -1;
    const desde = destino >= 0 && destino <= frame.pasoActual ? destino : frame.pasoActual;
    for (const p of pasos.slice(desde, frame.pasoActual + 1)) {
      frame.datos[p.id] = undefined;
      frame.datos[etiquetaKey(p.id)] = undefined;
    }
    frame.pasoActual = desde;
    const repregunta = await renderDesde(estado, registro);
    return "texto" in repregunta ? { ...repregunta, texto: `${aviso.mensaje}\n\n${repregunta.texto}` } : repregunta;
  }
  frame.pasoActual += 1;
  return renderDesde(estado, registro);
}

export function iniciarFlujo(
  estado: FlowState,
  flowId: FlowId,
  datosIniciales: DatosFlujo = {},
  registro: RegistroFlujos = FLUJOS,
): Promise<ResultadoFlujo> {
  estado.carga = (estado.carga ?? 0) + 1;
  estado.pila.push({ flowId, pasoActual: 0, datos: datosIniciales });
  return renderDesde(estado, registro);
}

/** Inicia un sub-flujo de alta inline (ej. crear una persona nueva en medio de crear_contrato).
 * `datosIniciales` precarga campos ya conocidos por contexto (ej. el rol de la persona) para no
 * volver a preguntarlos — se copia para no mutar el objeto compartido de la definición del paso. */
function iniciarSubFlujo(
  estado: FlowState,
  flowId: FlowId,
  campoDestino: string,
  registro: RegistroFlujos,
  datosIniciales: DatosFlujo = {},
): Promise<ResultadoFlujo> {
  estado.pila.push({ flowId, pasoActual: 0, datos: { ...datosIniciales }, campoDestino });
  return renderDesde(estado, registro);
}

function extraerId(textoResultado: string): string | undefined {
  return textoResultado.match(/\(id: ([^)]+)\)/)?.[1];
}

/** Guarda el resultado de un paso "entidad" (id + etiqueta de negocio) en el frame. */
function resolverEntidad(frame: FlowFrame, paso: PasoFlujo, candidato: CandidatoFlujo): void {
  frame.datos[paso.id] = candidato.id;
  frame.datos[etiquetaKey(paso.id)] = candidato.etiqueta;
  frame.candidatosPendientes = undefined;
}

/** Ejecuta la tool del frame superior (confirmación) y, si era un sub-flujo, resuelve el frame padre. */
async function finalizarFrameSuperior(estado: FlowState, registro: RegistroFlujos): Promise<ResultadoFlujo> {
  const frame = estado.pila.pop();
  if (!frame) return { tipo: "sin_flujo" };
  const definicion = registro[frame.flowId];
  const resultado = await definicion.ejecutar(frame.datos);
  const rechazado = typeof resultado !== "string";
  const resultadoTexto = typeof resultado === "string" ? resultado : resultado.texto;

  const padre = tope(estado);
  if (padre && frame.campoDestino && rechazado) {
    // El alta inline no se pudo hacer: se avisa y se vuelve a preguntar el mismo paso del padre.
    const repregunta = await renderDesde(estado, registro);
    return "texto" in repregunta
      ? { ...repregunta, texto: `${limpiarMarcadorId(resultadoTexto)}\n\n${repregunta.texto}` }
      : repregunta;
  }
  if (padre && frame.campoDestino) {
    const id = extraerId(resultadoTexto);
    if (id) {
      padre.datos[frame.campoDestino] = id;
      padre.datos[etiquetaKey(frame.campoDestino)] = definicion.etiqueta(frame.datos);
    }
    return siguientePaso(estado, registro);
  }

  if (rechazado) return { tipo: "completado", texto: limpiarMarcadorId(resultadoTexto) };

  // Referencia para los botones posteriores: lo elegido en el flujo, o lo recién creado.
  const idCreado = extraerId(resultadoTexto);
  const referencia: ReferenciaEntidad = {
    propiedadId:
      (frame.datos.propiedad_id as string | undefined) ?? (frame.flowId === "crear_propiedad" ? idCreado : undefined),
    contratoId:
      (frame.datos.contrato_id as string | undefined) ?? (frame.flowId === "crear_contrato" ? idCreado : undefined),
  };

  return {
    tipo: "completado",
    texto: limpiarMarcadorId(resultadoTexto),
    botonesPostAccion: definicion.botonesPostAccion,
    referencia,
  };
}

/**
 * Procesa un mensaje de texto libre del usuario mientras hay un flujo activo. Nunca llama a
 * OpenAI: si el texto no valida contra el paso actual, primero se chequea si es una interrupción
 * (pregunta, frase de menú, cancelación explícita) — si no lo es, se re-pregunta con una pista de
 * formato, sin salir del flujo.
 */
export async function procesarTexto(
  estado: FlowState,
  texto: string,
  etiquetasMenuPrincipal: readonly string[] = [],
  registro: RegistroFlujos = FLUJOS,
): Promise<ResultadoFlujo> {
  const frame = tope(estado);
  if (!frame) return { tipo: "sin_flujo" };
  const paso = pasoActualDe(frame, registro);
  if (!paso) return renderDesde(estado, registro);

  if (esInterrupcion(texto, etiquetasMenuPrincipal)) return { tipo: "interrumpido", textoOriginal: texto };

  switch (paso.campo.tipo) {
    case "texto": {
      const valor = texto.trim();
      if (valor === "") {
        if (!paso.campo.opcional) return { tipo: "reprompt", texto: pistaFormato(paso.campo), campo: paso.campo };
        frame.datos[paso.id] = undefined;
      } else {
        frame.datos[paso.id] = valor;
      }
      return siguientePaso(estado, registro);
    }
    case "numero": {
      const numero = parseNumeroUsuario(texto, paso.campo.min, paso.campo.max);
      if (numero === null) return { tipo: "reprompt", texto: pistaFormato(paso.campo), campo: paso.campo };
      frame.datos[paso.id] = numero;
      return siguientePaso(estado, registro);
    }
    case "monto": {
      const monto = parseMontoUsuario(texto);
      if (monto === null) return { tipo: "reprompt", texto: pistaFormato(paso.campo), campo: paso.campo };
      frame.datos[paso.id] = monto;
      return siguientePaso(estado, registro);
    }
    case "fecha": {
      const fecha = parseFechaUsuario(texto);
      if (fecha === null) return { tipo: "reprompt", texto: pistaFormato(paso.campo), campo: paso.campo };
      frame.datos[paso.id] = fecha;
      return siguientePaso(estado, registro);
    }
    case "periodo": {
      const periodo = parsePeriodoUsuario(texto);
      if (periodo === null) return { tipo: "reprompt", texto: pistaFormato(paso.campo), campo: paso.campo };
      frame.datos[paso.id] = periodo;
      return siguientePaso(estado, registro);
    }
    case "entidad": {
      const candidatos = (await paso.campo.buscar(texto.trim())).slice(0, MAX_CANDIDATOS_BUSQUEDA);
      frame.candidatosPendientes = candidatos;
      if (candidatos.length === 1) {
        resolverEntidad(frame, paso, candidatos[0]!);
        return siguientePaso(estado, registro);
      }
      const textoResultado =
        candidatos.length === 0
          ? `No encontré nada para "${texto.trim()}".`
          : `Encontré varias coincidencias para "${texto.trim()}", elegí una:`;
      return {
        tipo: "candidatos",
        texto: textoResultado,
        candidatos,
        permiteCrear: paso.campo.crear,
        etiquetaCrear: paso.campo.etiquetaCrear,
        esBusqueda: true,
      };
    }
    // "opciones" y "confirmacion" no aceptan texto libre — ya se filtró como interrupción arriba
    // si correspondía; si no, es simplemente un formato inválido para este paso.
    default:
      return { tipo: "reprompt", texto: pistaFormato(paso.campo), campo: paso.campo };
  }
}

/** Procesa una selección por botón: opciones, resultado de búsqueda, confirmación, cancelación, etc. */
export async function procesarSeleccion(
  estado: FlowState,
  accion: string,
  valor?: string,
  registro: RegistroFlujos = FLUJOS,
): Promise<ResultadoFlujo> {
  const frame = tope(estado);
  if (!frame) return { tipo: "sin_flujo" };

  // Cancelar pide confirmación primero (ver CALLBACK_CANCELAR_CONFIRMADO/CALLBACK_CONTINUAR) — no
  // toca el frame todavía, así que no hace falta resolver el paso actual para esto.
  if (accion === CALLBACK_CANCELAR) {
    return { tipo: "confirmar_cancelacion", texto: TEXTO_CONFIRMAR_CANCELACION };
  }
  if (accion === CALLBACK_CANCELAR_CONFIRMADO) {
    estado.pila.length = 0;
    return { tipo: "cancelado", texto: "Cancelado." };
  }

  const paso = pasoActualDe(frame, registro);
  if (!paso) return renderDesde(estado, registro);

  if (accion === CALLBACK_CONTINUAR) {
    return renderPaso(frame, paso);
  }

  if (accion === CALLBACK_CONFIRMAR && paso.campo.tipo === "confirmacion") {
    return finalizarFrameSuperior(estado, registro);
  }

  if (accion === CALLBACK_OMITIR) {
    const opcional = "opcional" in paso.campo && paso.campo.opcional === true;
    if (!opcional) return renderPaso(frame, paso);
    frame.datos[paso.id] = undefined;
    return siguientePaso(estado, registro);
  }

  if (accion === CALLBACK_HOY && paso.campo.tipo === "fecha" && paso.campo.permitirHoy) {
    frame.datos[paso.id] = new Date().toISOString().slice(0, 10);
    return siguientePaso(estado, registro);
  }

  if (accion === CALLBACK_BUSCAR_DE_NUEVO && paso.campo.tipo === "entidad") {
    frame.candidatosPendientes = undefined;
    return renderPaso(frame, paso);
  }

  if (accion === "opt" && paso.campo.tipo === "opciones" && valor !== undefined) {
    const opcion = paso.campo.opciones.find((o) => o.valor === valor);
    if (!opcion) return renderPaso(frame, paso);
    frame.datos[paso.id] = opcion.valor;
    return siguientePaso(estado, registro);
  }

  if (accion === "sel" && paso.campo.tipo === "entidad" && valor !== undefined) {
    const candidato = frame.candidatosPendientes?.[Number(valor)];
    if (!candidato) return renderPaso(frame, paso);
    resolverEntidad(frame, paso, candidato);
    return siguientePaso(estado, registro);
  }

  if (accion === "crear" && paso.campo.tipo === "entidad" && paso.campo.crear) {
    return iniciarSubFlujo(estado, paso.campo.crear, paso.id, registro, paso.campo.datosCrear);
  }

  return renderPaso(frame, paso);
}

export { crearEstadoFlujo } from "./types.js";
