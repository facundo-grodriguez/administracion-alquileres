import { crearPersonaTool } from "../../assistant/tools/crearPersona.tool.js";
import type { DefinicionFlujo } from "../types.js";

export const crearPersonaFlow: DefinicionFlujo = {
  id: "crear_persona",
  titulo: "👤 Persona",
  etiqueta: (datos) => datos.nombre_completo as string,
  pasos: [
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
  ejecutar: (datos) =>
    crearPersonaTool.run({
      nombre_completo: datos.nombre_completo as string,
      dni: datos.dni as string | undefined,
      telefono: datos.telefono as string | undefined,
    }),
};
