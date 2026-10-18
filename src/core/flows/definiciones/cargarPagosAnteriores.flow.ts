import * as pagosService from "../../services/pagos.service.js";
import { formatoPeriodoAR } from "../../util/fecha.js";
import { formatoARS } from "../../util/formato.js";
import { buscarContratosVigentesParaFlujo } from "../entidadHelpers.js";
import { type DefinicionFlujo, etiquetaKey } from "../types.js";

const MEDIOS_PAGO = [
  { valor: "transferencia", etiqueta: "Transferencia" },
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "omitir", etiqueta: "Omitir" },
];

async function ejecutar(datos: Record<string, unknown>): Promise<string> {
  const resultado = await pagosService.cargarPagosAnteriores({
    contratoId: datos.contrato_id as string,
    desde: datos.desde as string,
    hasta: datos.hasta as string,
    monto: (datos.monto as string | undefined) || undefined,
    medioPago: datos.medio_pago === "omitir" ? undefined : (datos.medio_pago as string | undefined),
  });
  if (resultado.tipo === "rango_invalido") {
    return `No cargué nada: ${resultado.motivo}. Volvé a intentarlo desde ➕ Nueva carga → 📚 Pagos anteriores.`;
  }
  const lineas = [`Listo, cargué ${resultado.cargados.length} mes(es) como pagados:`];
  for (const p of resultado.cargados) lineas.push(`  • ${formatoPeriodoAR(p.periodo)}: ${formatoARS(p.monto)}`);
  if (resultado.yaPagados.length > 0) {
    lineas.push("", `Ya figuraban pagados (no los toqué): ${resultado.yaPagados.map(formatoPeriodoAR).join(", ")}.`);
  }
  return lineas.join("\n");
}

export const cargarPagosAnterioresFlow: DefinicionFlujo = {
  id: "cargar_pagos_anteriores",
  titulo: "📚 Pagos anteriores",
  etiqueta: (datos) => datos[etiquetaKey("contrato_id")] as string,
  pasos: [
    {
      id: "contrato_id",
      pregunta: () => "¿De qué contrato son los pagos? Escribí el nombre del inquilino o la dirección.",
      campo: { tipo: "entidad", buscar: buscarContratosVigentesParaFlujo },
    },
    { id: "desde", pregunta: () => "¿Desde qué mes ya está cobrado? (MM/AAAA)", campo: { tipo: "periodo" } },
    { id: "hasta", pregunta: () => "¿Hasta qué mes, inclusive? (MM/AAAA)", campo: { tipo: "periodo" } },
    {
      id: "monto",
      pregunta: () =>
        "¿Cuánto pagó por mes? Si tocás Omitir, cada mes se carga con el valor que correspondía en ese momento " +
        "(el inicial y, después de cada actualización, el actualizado).",
      campo: { tipo: "monto", opcional: true },
    },
    {
      id: "medio_pago",
      pregunta: () => "¿Medio de pago? (opcional)",
      campo: { tipo: "opciones", opciones: MEDIOS_PAGO },
    },
    {
      id: "__confirmar",
      pregunta: (datos) =>
        [
          "Confirmá la carga de pagos anteriores:",
          "",
          `Contrato: ${datos[etiquetaKey("contrato_id")]}`,
          `Meses: ${formatoPeriodoAR(datos.desde as string)} a ${formatoPeriodoAR(datos.hasta as string)}`,
          datos.monto
            ? `Importe por mes: ${formatoARS(datos.monto as string)}`
            : "Importe: el que correspondía cada mes",
          "Los meses que ya figuran pagados no se modifican.",
        ].join("\n"),
      campo: { tipo: "confirmacion" },
    },
  ],
  ejecutar,
  botonesPostAccion: "post_pago",
};
