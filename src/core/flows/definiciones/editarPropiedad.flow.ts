import * as personasRepo from "../../repositories/personas.repository.js";
import * as propiedadesRepo from "../../repositories/propiedades.repository.js";
import { buscarPersonasParaFlujo, buscarPropiedadesParaFlujo } from "../entidadHelpers.js";
import { type DefinicionFlujo, etiquetaKey } from "../types.js";

const CAMPOS = [
  { valor: "direccion", etiqueta: "📍 Dirección / nombre" },
  { valor: "zona", etiqueta: "🗺️ Zona" },
  { valor: "tipo", etiqueta: "🏷️ Tipo" },
  { valor: "propietario", etiqueta: "👤 Propietario" },
];

const PREGUNTA_VALOR: Record<string, string> = {
  direccion: "¿Cuál es la dirección (o nombre) nueva?",
  zona: "¿Cuál es la zona nueva?",
  tipo: "¿Qué tipo de propiedad es? (ej: departamento, casa, local)",
};

const NOMBRE_CAMPO: Record<string, string> = {
  direccion: "Dirección",
  zona: "Zona",
  tipo: "Tipo",
  propietario: "Propietario",
};

export const editarPropiedadFlow: DefinicionFlujo = {
  id: "editar_propiedad",
  titulo: "🏠 Propiedad",
  etiqueta: (datos) => datos[etiquetaKey("propiedad_id")] as string,
  pasos: [
    {
      id: "propiedad_id",
      pregunta: () => "¿Qué propiedad querés modificar?",
      campo: { tipo: "entidad", buscar: buscarPropiedadesParaFlujo },
    },
    { id: "campo", pregunta: () => "¿Qué querés cambiar?", campo: { tipo: "opciones", opciones: CAMPOS } },
    {
      id: "valor",
      pregunta: (datos) => PREGUNTA_VALOR[datos.campo as string] ?? "¿Valor nuevo?",
      campo: { tipo: "texto" },
      saltar: (datos) => datos.campo === "propietario",
    },
    {
      id: "propietario_id",
      pregunta: () => "¿Quién es el propietario? Elegí uno de la lista o escribí el nombre/DNI para buscar otro.",
      campo: {
        tipo: "entidad",
        buscar: buscarPersonasParaFlujo(),
        crear: "crear_persona",
        datosCrear: { tipo_persona: "propietario" },
        etiquetaCrear: "➕ Crear propietario",
      },
      saltar: (datos) => datos.campo !== "propietario",
    },
    {
      id: "__confirmar",
      pregunta: (datos) =>
        [
          "Confirmá el cambio:",
          "",
          `Propiedad: ${datos[etiquetaKey("propiedad_id")]}`,
          `${NOMBRE_CAMPO[datos.campo as string]}: ${
            datos.campo === "propietario" ? datos[etiquetaKey("propietario_id")] : datos.valor
          }`,
        ].join("\n"),
      campo: { tipo: "confirmacion" },
    },
  ],
  ejecutar: async (datos) => {
    const id = datos.propiedad_id as string;
    const antes = await propiedadesRepo.obtenerPropiedadPorId(id);
    if (!antes) return "No encontré esa propiedad.";
    const campo = datos.campo as string;
    const valor = datos.valor as string | undefined;

    const despues = await propiedadesRepo.actualizarPropiedad(
      id,
      campo === "propietario" ? { propietarioId: datos.propietario_id as string } : { [campo]: valor },
    );
    if (!despues) return "No pude guardar el cambio.";

    let valorAnterior = (antes as Record<string, unknown>)[campo] as string | null;
    let valorNuevo = valor ?? "";
    if (campo === "propietario") {
      valorAnterior = (await personasRepo.obtenerPersonaPorId(antes.propietarioId))?.nombreCompleto ?? null;
      valorNuevo = (await personasRepo.obtenerPersonaPorId(despues.propietarioId))?.nombreCompleto ?? "";
    }
    return [
      "✏️ Propiedad modificada.",
      `${NOMBRE_CAMPO[campo]}: ${valorAnterior || "(vacío)"} → ${valorNuevo}`,
      campo === "direccion"
        ? "Los contratos, pagos y gastos de la propiedad siguen igual, solo cambia el nombre."
        : null,
    ]
      .filter(Boolean)
      .join("\n");
  },
};
