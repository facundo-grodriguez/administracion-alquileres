import { z } from "zod";
import * as actualizacionService from "../../services/actualizacionAlquiler.service.js";
import * as pagosService from "../../services/pagos.service.js";
import { formatoFechaAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { defineTool } from "../defineTool.js";

export const actualizarAlquilerTool = defineTool({
  name: "actualizar_alquiler",
  description:
    "Revisa si corresponde recalcular el alquiler de un contrato por IPC (según su frecuencia de " +
    "actualización) y, si corresponde, lo calcula y lo deja registrado. Si todavía no corresponde, " +
    "no hace ninguna consulta externa, solo avisa. Usar cuando el usuario pregunta por la actualización " +
    "o el aumento del alquiler de alguien.",
  inputSchema: z.object({
    inquilino_o_propiedad: z.string().describe("Nombre del inquilino o dirección de la propiedad"),
  }),
  run: async ({ inquilino_o_propiedad }) => {
    const resolucion = await pagosService.resolverContrato(inquilino_o_propiedad);
    if ("ambiguo" in resolucion) {
      return `Hay más de una coincidencia para "${inquilino_o_propiedad}". Pedile al usuario que aclare cuál: ${resolucion.ambiguo.join(", ")}.`;
    }
    if ("noEncontrado" in resolucion) {
      return `No se encontró ningún inquilino ni propiedad que coincida con "${inquilino_o_propiedad}".`;
    }
    if ("sinContratoVigente" in resolucion) {
      return `${resolucion.sinContratoVigente} no tiene un contrato vigente actualmente.`;
    }

    const { contrato } = resolucion;
    const resultado = await actualizacionService.actualizar(contrato);

    switch (resultado.tipo) {
      case "sin_indice_ipc":
        return (
          `El contrato de ${contrato.inquilino.nombreCompleto} en ${contrato.propiedad.direccion} no usa índice IPC ` +
          "(o no tiene un índice asignado), así que no aplica la actualización automática."
        );
      case "no_corresponde":
        return (
          `Este contrato no requiere actualización todavía. Próxima actualización: ` +
          `${formatoFechaAR(resultado.proximaFecha)}.`
        );
      case "sin_configurar":
        return "No tengo configurada la conexión con la API de actualización de alquileres. Hace falta cargar RAPIDAPI_KEY.";
      case "sin_datos_nuevos":
        return "Todavía no hay datos publicados de IPC para calcular la próxima actualización. Probá de nuevo más adelante.";
      case "actualizado": {
        const estimadoTxt = resultado.estimado
          ? " (estimado, puede ajustarse cuando se publique el dato definitivo)"
          : "";
        return [
          "Actualización de alquiler calculada.",
          `Inquilino: ${contrato.inquilino.nombreCompleto}`,
          `Propiedad: ${contrato.propiedad.direccion}`,
          `Valor anterior: ${formatoARS(resultado.valorAnterior)}`,
          `Valor actualizado: ${formatoARS(resultado.valorActualizado)}${estimadoTxt}`,
          `Diferencia: ${formatoARS(resultado.diferencia)}`,
          `Vigente desde: ${formatoFechaAR(resultado.fechaDesde)}`,
        ].join("\n");
      }
    }
  },
});
