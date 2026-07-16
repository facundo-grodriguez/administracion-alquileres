import { z } from "zod";
import * as pagosService from "../../services/pagos.service.js";
import { defineTool } from "../defineTool.js";

export const consultarGarantesTool = defineTool({
  name: "consultar_garantes",
  description:
    "Consulta quién es garante de un inquilino o propiedad. Usar cuando el usuario pregunta " +
    "'¿quién es garante de X?' o similares.",
  inputSchema: z.object({
    inquilino_o_propiedad: z.string().describe("Nombre del inquilino o dirección de la propiedad"),
  }),
  run: async ({ inquilino_o_propiedad }) => {
    const resultado = await pagosService.obtenerGarantes(inquilino_o_propiedad);

    switch (resultado.tipo) {
      case "ambiguo":
        return `Hay más de una coincidencia para "${inquilino_o_propiedad}". Pedile al usuario que aclare cuál: ${resultado.candidatos.join(", ")}.`;
      case "no_encontrado":
        return `No se encontró ningún inquilino ni propiedad que coincida con "${inquilino_o_propiedad}".`;
      case "sin_contrato_vigente":
        return `${resultado.nombre} no tiene un contrato vigente actualmente.`;
      case "resuelto":
        if (resultado.garantes.length === 0) {
          return `El contrato de ${resultado.inquilino} en ${resultado.propiedad} no tiene garantes cargados.`;
        }
        return [
          `Inquilino: ${resultado.inquilino}`,
          `Propiedad: ${resultado.propiedad}`,
          `Garantes:`,
          ...resultado.garantes.map(
            (g) =>
              `  - ${g.nombreCompleto}${g.dni ? ` (DNI ${g.dni})` : ""}${g.telefono ? ` — tel: ${g.telefono}` : ""}`,
          ),
        ].join("\n");
    }
  },
});
