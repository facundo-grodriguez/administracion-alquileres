import { crearPropiedadTool } from "../../assistant/tools/crearPropiedad.tool.js";
import { buscarPersonasParaFlujo } from "../entidadHelpers.js";
import { type DefinicionFlujo, etiquetaKey } from "../types.js";

const TIPOS = [
  { valor: "departamento", etiqueta: "Departamento" },
  { valor: "casa", etiqueta: "Casa" },
  { valor: "local", etiqueta: "Local" },
  { valor: "otro", etiqueta: "Otro" },
];

export const crearPropiedadFlow: DefinicionFlujo = {
  id: "crear_propiedad",
  titulo: "🏠 Propiedad",
  etiqueta: (datos) => datos.direccion as string,
  pasos: [
    { id: "direccion", pregunta: () => "¿Dirección completa de la propiedad?", campo: { tipo: "texto" } },
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
    },
    {
      id: "tipo_opcion",
      pregunta: () => "¿Qué tipo de propiedad es?",
      campo: { tipo: "opciones", opciones: TIPOS },
    },
    {
      id: "tipo_otro",
      pregunta: () => "¿Qué tipo es?",
      campo: { tipo: "texto" },
      saltar: (datos) => datos.tipo_opcion !== "otro",
    },
    { id: "zona", pregunta: () => "¿Zona o barrio? (opcional)", campo: { tipo: "texto", opcional: true } },
    {
      id: "__confirmar",
      pregunta: (datos) =>
        [
          "Confirmá los datos de la propiedad nueva:",
          "",
          `Dirección: ${datos.direccion}`,
          `Propietario: ${datos[etiquetaKey("propietario_id")]}`,
          `Tipo: ${datos.tipo_opcion === "otro" ? datos.tipo_otro : datos.tipo_opcion}`,
          datos.zona ? `Zona: ${datos.zona}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      campo: { tipo: "confirmacion" },
    },
  ],
  ejecutar: (datos) =>
    crearPropiedadTool.run({
      direccion: datos.direccion as string,
      propietario_id: datos.propietario_id as string,
      tipo: (datos.tipo_opcion === "otro" ? datos.tipo_otro : datos.tipo_opcion) as string | undefined,
      zona: datos.zona as string | undefined,
    }),
};
