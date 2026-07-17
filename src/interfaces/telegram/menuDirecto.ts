// Accesos del menú principal (Reply Keyboard) que son consultas fijas y deterministas: se
// resuelven con una llamada directa al repo/service correspondiente, sin pasar por ChatSession
// ni por OpenAI — mismo criterio que ya usa el comando /agenda existente.
import * as contratosRepo from "../../core/repositories/contratos.repository.js";
import * as propiedadesRepo from "../../core/repositories/propiedades.repository.js";
import * as pagosService from "../../core/services/pagos.service.js";
import { formatoFechaAR } from "../../core/util/fecha.js";
import { formatoARS } from "../../core/util/formato.js";

export async function listarPropiedadesTexto(): Promise<string> {
  const propiedades = await propiedadesRepo.listarPropiedades();
  if (propiedades.length === 0) return "Todavía no hay propiedades cargadas.";
  return propiedades
    .map((p) => `• ${p.direccion}${p.zona ? ` (${p.zona})` : ""} — propietario: ${p.propietario.nombreCompleto}`)
    .join("\n");
}

export async function listarContratosVigentesTexto(): Promise<string> {
  const contratos = await contratosRepo.listarContratosVigentes();
  if (contratos.length === 0) return "No hay contratos vigentes.";
  return contratos
    .map(
      (c) =>
        `• ${c.propiedad.direccion} — inquilino: ${c.inquilino.nombreCompleto} (hasta ${formatoFechaAR(c.fechaFin)})`,
    )
    .join("\n");
}

const ESTADO_TEXTO: Record<string, string> = {
  pagado: "pagado",
  pendiente: "pendiente",
  atrasado: "atrasado",
  parcial: "pago parcial",
};

export async function cobrosDelMesTexto(): Promise<string> {
  const cobros = await pagosService.resumenCobrosDelMes();
  const pendientes = cobros.filter((c) => c.estado !== "pagado");
  if (pendientes.length === 0) return "No queda nada pendiente de cobrar este mes. Todo al día. ✅";
  return pendientes
    .map(
      (c) =>
        `• ${c.inquilino} — ${c.propiedad}: ${formatoARS(c.monto)} (${ESTADO_TEXTO[c.estado]}, vence ${formatoFechaAR(c.fechaVencimiento)})`,
    )
    .join("\n");
}
