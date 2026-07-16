import * as contratosRepo from "../repositories/contratos.repository.js";
import * as movimientosRepo from "../repositories/movimientosFinancieros.repository.js";
import * as pagosRepo from "../repositories/pagos.repository.js";
import * as personasRepo from "../repositories/personas.repository.js";
import * as propiedadesRepo from "../repositories/propiedades.repository.js";
import { formatoPeriodoAR, hoyISO } from "../util/fecha.js";

type ContratoConRelaciones = NonNullable<Awaited<ReturnType<typeof contratosRepo.buscarContratoPorId>>>;
type EstadoPago = "pendiente" | "pagado" | "atrasado" | "parcial";

export type ResultadoEstadoPago =
  | { tipo: "ambiguo"; candidatos: string[] }
  | { tipo: "no_encontrado" }
  | { tipo: "sin_contrato_vigente"; nombre: string }
  | {
      tipo: "resuelto";
      contratoId: string;
      inquilino: string;
      propiedad: string;
      periodo: string;
      estado: EstadoPago;
      fechaVencimiento: string;
      fechaPago: string | null;
      monto: string | null;
    };

async function resolverContrato(
  inquilinoOPropiedad: string,
): Promise<
  { contrato: ContratoConRelaciones } | { ambiguo: string[] } | { sinContratoVigente: string } | { noEncontrado: true }
> {
  const personasCoincidentes = await personasRepo.buscarPersonas(inquilinoOPropiedad, "inquilino");
  if (personasCoincidentes.length === 1) {
    const persona = personasCoincidentes[0]!;
    const contrato = await contratosRepo.buscarContratoVigentePorInquilino(persona.id);
    return contrato ? { contrato } : { sinContratoVigente: persona.nombreCompleto };
  }
  if (personasCoincidentes.length > 1) {
    return { ambiguo: personasCoincidentes.map((p) => `${p.nombreCompleto}${p.dni ? ` (DNI ${p.dni})` : ""}`) };
  }

  const propiedadesCoincidentes = await propiedadesRepo.buscarPropiedades(inquilinoOPropiedad);
  if (propiedadesCoincidentes.length === 1) {
    const propiedad = propiedadesCoincidentes[0]!;
    const contrato = await contratosRepo.buscarContratoVigentePorPropiedad(propiedad.id);
    return contrato ? { contrato } : { sinContratoVigente: propiedad.direccion };
  }
  if (propiedadesCoincidentes.length > 1) {
    return { ambiguo: propiedadesCoincidentes.map((p) => p.direccion) };
  }

  return { noEncontrado: true };
}

/** Estado de un período para un contrato: usa la fila de `pagos` si existe, o la deriva de la fecha de vencimiento. */
async function estadoPeriodoParaContrato(contrato: ContratoConRelaciones, periodoYYYYMM: string) {
  const periodoDate = `${periodoYYYYMM}-01`;
  const pagoExistente = await pagosRepo.buscarPagoPorContratoYPeriodo(contrato.id, periodoDate);

  const fechaVencimiento =
    pagoExistente?.fechaVencimiento ?? `${periodoYYYYMM}-${String(contrato.diaVencimientoPago).padStart(2, "0")}`;
  const estado: EstadoPago = pagoExistente?.estado ?? (fechaVencimiento < hoyISO() ? "atrasado" : "pendiente");

  return {
    pagoId: pagoExistente?.id ?? null,
    estado,
    fechaVencimiento,
    fechaPago: pagoExistente?.fechaPago ?? null,
    monto: pagoExistente?.monto ?? contrato.valorAlquilerInicial,
  };
}

export async function obtenerEstadoPago(inquilinoOPropiedad: string, periodo?: string): Promise<ResultadoEstadoPago> {
  const resolucion = await resolverContrato(inquilinoOPropiedad);
  if ("ambiguo" in resolucion) return { tipo: "ambiguo", candidatos: resolucion.ambiguo };
  if ("noEncontrado" in resolucion) return { tipo: "no_encontrado" };
  if ("sinContratoVigente" in resolucion)
    return { tipo: "sin_contrato_vigente", nombre: resolucion.sinContratoVigente };

  const { contrato } = resolucion;
  const periodoYYYYMM = periodo ?? hoyISO().slice(0, 7);
  const estadoPeriodo = await estadoPeriodoParaContrato(contrato, periodoYYYYMM);

  return {
    tipo: "resuelto",
    contratoId: contrato.id,
    inquilino: contrato.inquilino.nombreCompleto,
    propiedad: contrato.propiedad.direccion,
    periodo: periodoYYYYMM,
    ...estadoPeriodo,
  };
}

export type ResultadoGarantes =
  | { tipo: "ambiguo"; candidatos: string[] }
  | { tipo: "no_encontrado" }
  | { tipo: "sin_contrato_vigente"; nombre: string }
  | {
      tipo: "resuelto";
      inquilino: string;
      propiedad: string;
      garantes: { nombreCompleto: string; dni: string | null; telefono: string | null }[];
    };

export async function obtenerGarantes(inquilinoOPropiedad: string): Promise<ResultadoGarantes> {
  const resolucion = await resolverContrato(inquilinoOPropiedad);
  if ("ambiguo" in resolucion) return { tipo: "ambiguo", candidatos: resolucion.ambiguo };
  if ("noEncontrado" in resolucion) return { tipo: "no_encontrado" };
  if ("sinContratoVigente" in resolucion)
    return { tipo: "sin_contrato_vigente", nombre: resolucion.sinContratoVigente };

  const { contrato } = resolucion;
  return {
    tipo: "resuelto",
    inquilino: contrato.inquilino.nombreCompleto,
    propiedad: contrato.propiedad.direccion,
    garantes: contrato.garantes.map((g) => ({
      nombreCompleto: g.persona.nombreCompleto,
      dni: g.persona.dni,
      telefono: g.persona.telefono,
    })),
  };
}

export async function crearRecibo(input: {
  contratoId: string;
  periodo: string;
  monto: string;
  fechaPago: string;
  medioPago?: string;
}) {
  const contrato = await contratosRepo.buscarContratoPorId(input.contratoId);
  if (!contrato) throw new Error(`No existe el contrato ${input.contratoId}`);

  const periodoDate = `${input.periodo}-01`;
  const existente = await pagosRepo.buscarPagoPorContratoYPeriodo(input.contratoId, periodoDate);

  const pago = existente
    ? // Si ya había una fila para este período (ej: se está corrigiendo un pago cargado antes),
      // actualiza también el monto — antes quedaba pisado en silencio con el valor viejo.
      await pagosRepo.registrarPagoRecibido(existente.id, input.fechaPago, input.monto, input.medioPago)
    : await pagosRepo.crearPago({
        contratoId: input.contratoId,
        periodo: periodoDate,
        monto: input.monto,
        fechaVencimiento: `${input.periodo}-${String(contrato.diaVencimientoPago).padStart(2, "0")}`,
        fechaPago: input.fechaPago,
        estado: "pagado",
        medioPago: input.medioPago,
      });

  if (pago?.fechaPago) {
    try {
      await movimientosRepo.upsertPorReferencia({
        propiedadId: contrato.propiedadId,
        tipo: "ingreso",
        categoria: "alquiler",
        monto: pago.monto,
        fecha: pago.fechaPago,
        referenciaTipo: "pago",
        referenciaId: pago.id,
        descripcion: `Alquiler ${formatoPeriodoAR(input.periodo)} — ${contrato.inquilino.nombreCompleto}`,
      });
    } catch (error) {
      console.error("No se pudo registrar el movimiento financiero del pago:", error);
    }
  }

  return { pago, contrato };
}

export type CobroDelMes = {
  contratoId: string;
  inquilino: string;
  propiedad: string;
  periodo: string;
  fechaVencimiento: string;
  monto: string;
  estado: EstadoPago;
};

/** Todo lo que corresponde cobrar en el período actual entre los contratos vigentes. */
export async function resumenCobrosDelMes(): Promise<CobroDelMes[]> {
  const contratosVigentes = await contratosRepo.listarContratosVigentes();
  const periodoActual = hoyISO().slice(0, 7);

  return Promise.all(
    contratosVigentes.map(async (contrato) => {
      const estadoPeriodo = await estadoPeriodoParaContrato(contrato, periodoActual);
      return {
        contratoId: contrato.id,
        inquilino: contrato.inquilino.nombreCompleto,
        propiedad: contrato.propiedad.direccion,
        periodo: periodoActual,
        fechaVencimiento: estadoPeriodo.fechaVencimiento,
        monto: estadoPeriodo.monto,
        estado: estadoPeriodo.estado,
      };
    }),
  );
}
