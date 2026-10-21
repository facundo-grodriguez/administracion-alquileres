import { crearContratoTool, validarSuperposicion } from "../../assistant/tools/crearContrato.tool.js";
import * as contratosRepo from "../../repositories/contratos.repository.js";
import { formatoFechaAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { buscarPersonasParaFlujo, buscarPropiedadesParaFlujo } from "../entidadHelpers.js";
import { type CandidatoFlujo, type DefinicionFlujo, etiquetaKey, type PasoFlujo } from "../types.js";

/** Propiedades para el alta de contrato, marcando las que ya tienen un contrato vigente. */
async function buscarPropiedadesConEstado(query: string): Promise<CandidatoFlujo[]> {
  const candidatos = await buscarPropiedadesParaFlujo(query);
  return Promise.all(
    candidatos.map(async (c) => {
      const vigente = await contratosRepo.buscarContratoVigentePorPropiedad(c.id);
      return vigente ? { ...c, etiqueta: `🔴 ${c.etiqueta} — alquilada hasta ${formatoFechaAR(vigente.fechaFin)}` } : c;
    }),
  );
}

const SI_NO = [
  { valor: "si", etiqueta: "✅ Sí" },
  { valor: "no", etiqueta: "❌ No" },
];

const FRECUENCIAS = [
  { valor: "mensual", etiqueta: "Mensual" },
  { valor: "trimestral", etiqueta: "Trimestral" },
  { valor: "semestral", etiqueta: "Semestral" },
  { valor: "anual", etiqueta: "Anual" },
];

const INDICES = [
  { valor: "IPC", etiqueta: "IPC" },
  { valor: "ICL", etiqueta: "ICL" },
  { valor: "ninguno", etiqueta: "Ninguno" },
];

/** Un garante más en el loop acotado (hasta 3): "¿Agregar garante N?" + selector si dijo que sí. */
function pasoGaranteSiNo(n: 1 | 2 | 3): PasoFlujo {
  return {
    id: `garante${n}_si`,
    pregunta: () => (n === 1 ? "¿El contrato tiene garante?" : "¿Agregar otro garante?"),
    campo: { tipo: "opciones", opciones: SI_NO },
    saltar: (datos) => n > 1 && datos[`garante${n - 1}_si`] !== "si",
  };
}

function pasoGaranteId(n: 1 | 2 | 3): PasoFlujo {
  return {
    id: `garante${n}_id`,
    pregunta: () => "¿Quién es? Elegí uno de la lista o escribí el nombre/DNI para buscar otro.",
    campo: {
      tipo: "entidad",
      buscar: buscarPersonasParaFlujo(undefined, { sinPropietariosEnListado: true }),
      crear: "crear_persona",
      datosCrear: { tipo_persona: "garante" },
      etiquetaCrear: "➕ Crear garante",
    },
    saltar: (datos) => datos[`garante${n}_si`] !== "si",
  };
}

export const crearContratoFlow: DefinicionFlujo = {
  id: "crear_contrato",
  titulo: "📄 Contrato",
  etiqueta: (datos) => `${datos[etiquetaKey("inquilino_id")]} — ${datos[etiquetaKey("propiedad_id")]}`,
  pasos: [
    {
      id: "propiedad_id",
      pregunta: () =>
        "¿De qué propiedad es el contrato? Elegí una de la lista o escribí la dirección para buscar otra.",
      campo: {
        tipo: "entidad",
        buscar: buscarPropiedadesConEstado,
        crear: "crear_propiedad",
        etiquetaCrear: "➕ Crear propiedad",
      },
    },
    {
      id: "inquilino_id",
      pregunta: () => "¿Quién es el inquilino? Elegí uno de la lista o escribí el nombre/DNI para buscar otro.",
      campo: {
        tipo: "entidad",
        buscar: buscarPersonasParaFlujo(undefined, { sinPropietariosEnListado: true }),
        crear: "crear_persona",
        datosCrear: { tipo_persona: "inquilino" },
        etiquetaCrear: "➕ Crear inquilino",
      },
    },
    pasoGaranteSiNo(1),
    pasoGaranteId(1),
    pasoGaranteSiNo(2),
    pasoGaranteId(2),
    pasoGaranteSiNo(3),
    pasoGaranteId(3),
    { id: "fecha_inicio", pregunta: () => "¿Fecha de inicio del contrato? (DD/MM/AAAA)", campo: { tipo: "fecha" } },
    {
      id: "fecha_fin",
      pregunta: () => "¿Fecha de finalización? (DD/MM/AAAA)",
      campo: { tipo: "fecha" },
      // Se chequea acá (y no al final) para no hacer completar todo el alta en vano.
      validar: async (datos) => {
        const aviso = await validarSuperposicion(
          datos.propiedad_id as string,
          datos.fecha_inicio as string,
          datos.fecha_fin as string,
        );
        return aviso ? { mensaje: aviso, volverA: "fecha_inicio" } : undefined;
      },
    },
    { id: "valor_alquiler", pregunta: () => "¿Valor inicial del alquiler?", campo: { tipo: "monto" } },
    {
      id: "frecuencia_actualizacion",
      pregunta: () => "¿Cada cuánto se actualiza el alquiler?",
      campo: { tipo: "opciones", opciones: FRECUENCIAS },
    },
    {
      id: "indice_actualizacion",
      pregunta: () => "¿Con qué índice se actualiza?",
      campo: { tipo: "opciones", opciones: INDICES },
    },
    {
      id: "dia_vencimiento_pago",
      pregunta: () => "¿Día del mes en que vence el pago? (opcional, por defecto día 10)",
      campo: { tipo: "numero", opcional: true, min: 1, max: 28 },
    },
    {
      id: "finaer_si_no",
      pregunta: () => "¿El contrato tiene Seguro Finaer?",
      campo: { tipo: "opciones", opciones: SI_NO },
    },
    {
      id: "finaer_numero_poliza",
      pregunta: () => "¿Número de póliza? (opcional)",
      campo: { tipo: "texto", opcional: true },
      saltar: (datos) => datos.finaer_si_no !== "si",
    },
    {
      id: "finaer_fecha_inicio",
      pregunta: () => "¿Fecha de inicio del Seguro Finaer? (opcional)",
      campo: { tipo: "fecha", opcional: true, permitirHoy: true },
      saltar: (datos) => datos.finaer_si_no !== "si",
    },
    {
      id: "finaer_fecha_vencimiento",
      pregunta: () => "¿Fecha de vencimiento del Seguro Finaer? (opcional)",
      campo: { tipo: "fecha", opcional: true },
      saltar: (datos) => datos.finaer_si_no !== "si",
    },
    {
      id: "__confirmar",
      pregunta: (datos) =>
        [
          "Confirmá los datos del contrato nuevo:",
          "",
          `Propiedad: ${datos[etiquetaKey("propiedad_id")]}`,
          `Inquilino: ${datos[etiquetaKey("inquilino_id")]}`,
          garantesTexto(datos),
          `Inicio: ${formatoFechaAR(datos.fecha_inicio as string)}`,
          `Finalización: ${formatoFechaAR(datos.fecha_fin as string)}`,
          `Alquiler inicial: ${formatoARS(datos.valor_alquiler as string)}`,
          `Actualización: ${datos.frecuencia_actualizacion}${datos.indice_actualizacion !== "ninguno" ? ` por ${datos.indice_actualizacion}` : ""}`,
          datos.dia_vencimiento_pago ? `Vencimiento mensual: día ${datos.dia_vencimiento_pago}` : null,
          datos.finaer_si_no === "si" ? "Seguro Finaer: sí" : null,
        ]
          .filter(Boolean)
          .join("\n"),
      campo: { tipo: "confirmacion" },
    },
  ],
  ejecutar: async (datos) => {
    const aviso = await validarSuperposicion(
      datos.propiedad_id as string,
      datos.fecha_inicio as string,
      datos.fecha_fin as string,
    );
    if (aviso) return { texto: aviso, rechazado: true };
    return crearContratoTool.run({
      propiedad_id: datos.propiedad_id as string,
      inquilino_id: datos.inquilino_id as string,
      garante_ids: garanteIds(datos),
      fecha_inicio: datos.fecha_inicio as string,
      fecha_fin: datos.fecha_fin as string,
      valor_alquiler: datos.valor_alquiler as string,
      frecuencia_actualizacion: datos.frecuencia_actualizacion as "mensual" | "trimestral" | "semestral" | "anual",
      indice_actualizacion:
        datos.indice_actualizacion === "ninguno" ? undefined : (datos.indice_actualizacion as "IPC" | "ICL"),
      dia_vencimiento_pago: datos.dia_vencimiento_pago as number | undefined,
      finaer_numero_poliza: datos.finaer_numero_poliza as string | undefined,
      finaer_fecha_inicio: datos.finaer_fecha_inicio as string | undefined,
      finaer_fecha_vencimiento: datos.finaer_fecha_vencimiento as string | undefined,
    });
  },
};

function garanteIds(datos: Record<string, unknown>): string[] {
  return [datos.garante1_id, datos.garante2_id, datos.garante3_id].filter((id): id is string => typeof id === "string");
}

function garantesTexto(datos: Record<string, unknown>): string | null {
  const etiquetas = [
    datos[etiquetaKey("garante1_id")],
    datos[etiquetaKey("garante2_id")],
    datos[etiquetaKey("garante3_id")],
  ].filter((e): e is string => typeof e === "string");
  return etiquetas.length > 0 ? `Garantes: ${etiquetas.join(", ")}` : null;
}
