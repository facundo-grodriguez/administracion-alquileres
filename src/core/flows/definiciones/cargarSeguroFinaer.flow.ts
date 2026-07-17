import { cargarSeguroFinaerTool } from "../../assistant/tools/cargarSeguroFinaer.tool.js";
import * as contratosRepo from "../../repositories/contratos.repository.js";
import { buscarContratosVigentesParaFlujo } from "../entidadHelpers.js";
import { type DefinicionFlujo, etiquetaKey } from "../types.js";

export const cargarSeguroFinaerFlow: DefinicionFlujo = {
  id: "cargar_seguro_finaer",
  titulo: "🛡️ Seguro Finaer",
  etiqueta: (datos) => datos[etiquetaKey("contrato_id")] as string,
  pasos: [
    {
      id: "contrato_id",
      pregunta: () => "¿De qué contrato es el Seguro Finaer? Escribí el nombre del inquilino o la dirección.",
      campo: { tipo: "entidad", buscar: buscarContratosVigentesParaFlujo },
    },
    { id: "numero_poliza", pregunta: () => "¿Número de póliza? (opcional)", campo: { tipo: "texto", opcional: true } },
    {
      id: "fecha_inicio",
      pregunta: () => "¿Fecha de inicio de la póliza? (opcional)",
      campo: { tipo: "fecha", opcional: true, permitirHoy: true },
    },
    {
      id: "fecha_vencimiento",
      pregunta: () => "¿Fecha de vencimiento de la póliza? (opcional)",
      campo: { tipo: "fecha", opcional: true },
    },
    {
      id: "__confirmar",
      pregunta: (datos) =>
        [
          "Confirmá los datos del Seguro Finaer:",
          "",
          `Contrato: ${datos[etiquetaKey("contrato_id")]}`,
          datos.numero_poliza ? `Póliza: ${datos.numero_poliza}` : null,
          datos.fecha_vencimiento ? `Vencimiento: ${datos.fecha_vencimiento}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      campo: { tipo: "confirmacion" },
    },
  ],
  // cargar_seguro_finaer_tool resuelve el contrato por texto libre (inquilino o propiedad), no
  // por id — como el picker ya desambiguó a un contrato puntual, le pasamos el nombre exacto del
  // inquilino (no la etiqueta combinada del picker, que no matchea ningún campo de la base).
  ejecutar: async (datos) => {
    const contrato = await contratosRepo.buscarContratoPorId(datos.contrato_id as string);
    const query = contrato ? contrato.inquilino.nombreCompleto : (datos[etiquetaKey("contrato_id")] as string);
    return cargarSeguroFinaerTool.run({
      inquilino_o_propiedad: query,
      numero_poliza: datos.numero_poliza as string | undefined,
      fecha_inicio: datos.fecha_inicio as string | undefined,
      fecha_vencimiento: datos.fecha_vencimiento as string | undefined,
    });
  },
};
