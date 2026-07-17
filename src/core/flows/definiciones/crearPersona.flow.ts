import { crearPersonaTool } from "../../assistant/tools/crearPersona.tool.js";
import type { DefinicionFlujo } from "../types.js";

const TIPOS_PERSONA = [
  { valor: "propietario", etiqueta: "👤 Propietario" },
  { valor: "inquilino", etiqueta: "🏠 Inquilino" },
  { valor: "garante", etiqueta: "🛡️ Garante" },
];

const ENCABEZADO_POR_TIPO: Record<string, string> = {
  propietario: "✅ Propietario registrado correctamente.",
  inquilino: "✅ Inquilino registrado correctamente.",
  garante: "✅ Garante registrado correctamente.",
};

export const crearPersonaFlow: DefinicionFlujo = {
  id: "crear_persona",
  titulo: "👤 Persona",
  etiqueta: (datos) => datos.nombre_completo as string,
  pasos: [
    {
      id: "tipo_persona",
      pregunta: () => "¿Qué tipo de persona es?",
      campo: { tipo: "opciones", opciones: TIPOS_PERSONA },
      // Si ya viene precargado (alta inline desde crear_contrato/crear_propiedad, donde el rol
      // ya se sabe por contexto) no hace falta volver a preguntarlo.
      saltar: (datos) => datos.tipo_persona !== undefined,
    },
    { id: "nombre_completo", pregunta: () => "¿Nombre y apellido?", campo: { tipo: "texto" } },
    { id: "dni", pregunta: () => "¿DNI? (opcional)", campo: { tipo: "texto", opcional: true } },
    { id: "telefono", pregunta: () => "¿Teléfono? (opcional)", campo: { tipo: "texto", opcional: true } },
    {
      id: "__confirmar",
      pregunta: (datos) =>
        [
          "Confirmá los datos de la persona nueva:",
          "",
          `Nombre: ${datos.nombre_completo}`,
          datos.dni ? `DNI: ${datos.dni}` : null,
          datos.telefono ? `Teléfono: ${datos.telefono}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      campo: { tipo: "confirmacion" },
    },
  ],
  ejecutar: async (datos) => {
    const resultado = await crearPersonaTool.run({
      nombre_completo: datos.nombre_completo as string,
      dni: datos.dni as string | undefined,
      telefono: datos.telefono as string | undefined,
    });
    // La tool devuelve "Persona registrada.\n..." — se reemplaza esa primera línea por un
    // encabezado que dice qué rol se le dio de alta (el resto de las líneas, incluido el
    // marcador (id: ...) que necesitan los sub-flujos, se mantiene intacto).
    const encabezado = ENCABEZADO_POR_TIPO[datos.tipo_persona as string] ?? "✅ Persona registrada correctamente.";
    const resto = resultado.split("\n").slice(1).join("\n");
    return resto ? `${encabezado}\n${resto}` : encabezado;
  },
};
