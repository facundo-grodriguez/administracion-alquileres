import * as contratosRepo from "../repositories/contratos.repository.js";
import * as movimientosRepo from "../repositories/movimientosFinancieros.repository.js";
import * as pagosRepo from "../repositories/pagos.repository.js";
import * as personasRepo from "../repositories/personas.repository.js";
import * as propiedadesRepo from "../repositories/propiedades.repository.js";
import { formatoPeriodoAR, hoyISO, periodosEntre } from "../util/fecha.js";
import { valorVigente } from "./actualizacionAlquiler.service.js";

export type ContratoConRelaciones = NonNullable<Awaited<ReturnType<typeof contratosRepo.buscarContratoPorId>>>;
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

export async function resolverContrato(
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
    // Sin pago cargado, lo que corresponde cobrar es el valor vigente en ese período (con las
    // actualizaciones ya registradas), no el precio inicial del contrato.
    monto: pagoExistente?.monto ?? (await valorVigente(contrato, fechaVencimiento)),
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
  observaciones?: string;
}) {
  const contrato = await contratosRepo.buscarContratoPorId(input.contratoId);
  if (!contrato) throw new Error(`No existe el contrato ${input.contratoId}`);

  const periodoDate = `${input.periodo}-01`;
  const existente = await pagosRepo.buscarPagoPorContratoYPeriodo(input.contratoId, periodoDate);

  const pago = existente
    ? // Si ya había una fila para este período (ej: se está corrigiendo un pago cargado antes),
      // actualiza también el monto — antes quedaba pisado en silencio con el valor viejo.
      await pagosRepo.registrarPagoRecibido(
        existente.id,
        input.fechaPago,
        input.monto,
        input.medioPago,
        input.observaciones,
      )
    : await pagosRepo.crearPago({
        contratoId: input.contratoId,
        periodo: periodoDate,
        monto: input.monto,
        fechaVencimiento: `${input.periodo}-${String(contrato.diaVencimientoPago).padStart(2, "0")}`,
        fechaPago: input.fechaPago,
        estado: "pagado",
        medioPago: input.medioPago,
        observaciones: input.observaciones,
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

export type PeriodoHistorial = {
  periodo: string;
  estado: EstadoPago;
  monto: string;
  fechaVencimiento: string;
  fechaPago: string | null;
};

/**
 * Estado mes a mes de un contrato, desde su primer mes hasta el mes actual (o el fin del
 * contrato, si es anterior). Los meses sin pago cargado salen como "atrasado"/"pendiente" según
 * la fecha de vencimiento, con el valor que correspondía cobrar en ese momento.
 */
export async function historialPagos(contrato: ContratoConRelaciones): Promise<PeriodoHistorial[]> {
  const mesActual = hoyISO().slice(0, 7);
  const hasta = contrato.fechaFin.slice(0, 7) < mesActual ? contrato.fechaFin.slice(0, 7) : mesActual;
  const cargados = new Map((await pagosRepo.listarPorContrato(contrato.id)).map((p) => [p.periodo.slice(0, 7), p]));

  return Promise.all(
    periodosEntre(contrato.fechaInicio.slice(0, 7), hasta).map(async (periodo) => {
      const pago = cargados.get(periodo);
      const fechaVencimiento =
        pago?.fechaVencimiento ?? `${periodo}-${String(contrato.diaVencimientoPago).padStart(2, "0")}`;
      return {
        periodo,
        estado: pago?.estado ?? (fechaVencimiento < hoyISO() ? "atrasado" : "pendiente"),
        monto: pago?.monto ?? (await valorVigente(contrato, fechaVencimiento)),
        fechaVencimiento,
        fechaPago: pago?.fechaPago ?? null,
      } satisfies PeriodoHistorial;
    }),
  );
}

export type DeudaAnterior = {
  contratoId: string;
  inquilino: string;
  propiedad: string;
  periodos: PeriodoHistorial[];
};

/** Meses ANTERIORES al actual que no figuran como pagados, por contrato vigente. */
export async function deudasMesesAnteriores(): Promise<DeudaAnterior[]> {
  const mesActual = hoyISO().slice(0, 7);
  const contratosVigentes = await contratosRepo.listarContratosVigentes();
  const deudas = await Promise.all(
    contratosVigentes.map(async (contrato) => ({
      contratoId: contrato.id,
      inquilino: contrato.inquilino.nombreCompleto,
      propiedad: contrato.propiedad.direccion,
      periodos: (await historialPagos(contrato)).filter((p) => p.periodo < mesActual && p.estado !== "pagado"),
    })),
  );
  return deudas.filter((d) => d.periodos.length > 0);
}

export type ResultadoPagosAnteriores =
  | { tipo: "rango_invalido"; motivo: string }
  | { tipo: "cargado"; cargados: PeriodoHistorial[]; yaPagados: string[] };

const MAX_MESES_CARGA = 36;

/**
 * Carga de una vez varios meses ya cobrados (para quien empieza a usar el bot con un contrato
 * que viene de antes). Los meses que ya figuraban pagados no se tocan. Si no se pasa monto, cada
 * mes toma el valor que correspondía en ese momento; la fecha de pago queda como la de
 * vencimiento de cada mes.
 */
export async function cargarPagosAnteriores(input: {
  contratoId: string;
  desde: string;
  hasta: string;
  monto?: string;
  medioPago?: string;
}): Promise<ResultadoPagosAnteriores> {
  const contrato = await contratosRepo.buscarContratoPorId(input.contratoId);
  if (!contrato) throw new Error(`No existe el contrato ${input.contratoId}`);

  const mesActual = hoyISO().slice(0, 7);
  const inicio = contrato.fechaInicio.slice(0, 7);
  if (input.desde > input.hasta) return { tipo: "rango_invalido", motivo: "el mes inicial es posterior al final" };
  if (input.hasta > mesActual) return { tipo: "rango_invalido", motivo: "no se pueden cargar meses futuros" };
  if (input.desde < inicio) {
    return { tipo: "rango_invalido", motivo: `el contrato empieza en ${formatoPeriodoAR(inicio)}` };
  }
  const periodos = periodosEntre(input.desde, input.hasta);
  if (periodos.length > MAX_MESES_CARGA) {
    return { tipo: "rango_invalido", motivo: `son más de ${MAX_MESES_CARGA} meses, cargalos en tandas` };
  }

  const historial = new Map((await historialPagos(contrato)).map((p) => [p.periodo, p]));
  const cargados: PeriodoHistorial[] = [];
  const yaPagados: string[] = [];
  for (const periodo of periodos) {
    const actual = historial.get(periodo);
    if (actual?.estado === "pagado") {
      yaPagados.push(periodo);
      continue;
    }
    const fechaVencimiento =
      actual?.fechaVencimiento ?? `${periodo}-${String(contrato.diaVencimientoPago).padStart(2, "0")}`;
    const monto = input.monto ?? actual?.monto ?? (await valorVigente(contrato, fechaVencimiento));
    const { pago } = await crearRecibo({
      contratoId: contrato.id,
      periodo,
      monto,
      // La fecha real de cobro no se conoce: se usa la de vencimiento (o hoy, si todavía no llegó).
      fechaPago: fechaVencimiento < hoyISO() ? fechaVencimiento : hoyISO(),
      medioPago: input.medioPago,
      observaciones: "Carga de pagos anteriores",
    });
    if (pago) {
      cargados.push({ periodo, estado: "pagado", monto: pago.monto, fechaVencimiento, fechaPago: pago.fechaPago });
    }
  }
  return { tipo: "cargado", cargados, yaPagados };
}
