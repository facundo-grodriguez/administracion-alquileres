import "dotenv/config";
import { db } from "../src/core/db/client.js";
import {
  actualizacionesContrato,
  contratos,
  contratosGarantes,
  gastosPropiedad,
  movimientosFinancieros,
  pagos,
  personas,
  propiedades,
} from "../src/core/db/schema.js";
import { hoyISO, sumarDiasISO } from "../src/core/util/fecha.js";

function unico<T>(filas: T[]): T {
  return filas[0]!;
}

async function seed() {
  console.log("Sembrando datos de prueba...");

  const propietario = unico(
    await db
      .insert(personas)
      .values({ nombreCompleto: "Roberto Gómez", dni: "20123456", telefono: "1122334455" })
      .returning(),
  );

  const juan = unico(
    await db
      .insert(personas)
      .values({ nombreCompleto: "Juan Pérez", dni: "30456789", telefono: "1155667788" })
      .returning(),
  );

  const garante = unico(
    await db
      .insert(personas)
      .values({ nombreCompleto: "Carlos Ibáñez", dni: "25334455", telefono: "1166778899" })
      .returning(),
  );

  const propiedad = unico(
    await db
      .insert(propiedades)
      .values({ direccion: "Av. Rivadavia 1234", zona: "Caseros", propietarioId: propietario.id, tipo: "departamento" })
      .returning(),
  );

  const hoy = hoyISO();
  const periodoActual = hoy.slice(0, 7);

  // Contrato con índice IPC trimestral (para probar actualizar_alquiler) y Seguro Finaer cargado.
  const contrato = unico(
    await db
      .insert(contratos)
      .values({
        propiedadId: propiedad.id,
        inquilinoId: juan.id,
        fechaInicio: sumarDiasISO(hoy, -180),
        fechaFin: sumarDiasISO(hoy, 550),
        valorAlquilerInicial: "150000",
        diaVencimientoPago: 10,
        indiceActualizacion: "IPC",
        frecuenciaActualizacion: "trimestral",
        deposito: "150000",
        estado: "vigente",
        finaerActivo: true,
        finaerNumeroPoliza: "FIN-2026-001",
        finaerFechaInicio: sumarDiasISO(hoy, -180),
        finaerFechaVencimiento: sumarDiasISO(hoy, 10),
      })
      .returning(),
  );

  await db.insert(contratosGarantes).values({ contratoId: contrato.id, personaId: garante.id });

  // Juan ya pagó el período actual → obtener_estado_pago debe mostrar "PAGADO".
  const pago = unico(
    await db
      .insert(pagos)
      .values({
        contratoId: contrato.id,
        periodo: `${periodoActual}-01`,
        monto: "150000",
        fechaVencimiento: `${periodoActual}-10`,
        fechaPago: sumarDiasISO(hoy, -1),
        estado: "pagado",
        medioPago: "transferencia",
      })
      .returning(),
  );

  // ABL por vencer en 8 días, a cargo del propietario → aparece en la agenda.
  const abl = unico(
    await db
      .insert(gastosPropiedad)
      .values({
        propiedadId: propiedad.id,
        tipo: "ABL",
        responsable: "propietario",
        fechaVencimiento: sumarDiasISO(hoy, 8),
        periodicidad: "bimestral",
        monto: "32000",
      })
      .returning(),
  );

  // Seguro hogar ya pagado → ejemplo de gasto resuelto, no debería aparecer en vencimientos.
  await db.insert(gastosPropiedad).values({
    propiedadId: propiedad.id,
    tipo: "seguro_hogar",
    fechaVencimiento: sumarDiasISO(hoy, 300),
    fechaPago: sumarDiasISO(hoy, -5),
    estado: "pagado",
    monto: "45000",
    observaciones: "La Caja, póliza POL-99887",
  });

  // Historial de una actualización de alquiler ya aplicada (deja el próximo cálculo pendiente).
  await db.insert(actualizacionesContrato).values({
    contratoId: contrato.id,
    fechaVigencia: sumarDiasISO(hoy, -90),
    valorNuevo: "150000",
    indiceAplicado: "IPC",
  });

  // Movimientos financieros: el ingreso del pago de Juan (tal como lo generaría el flujo real)
  // más un gasto manual, para tener ambos casos representados en los datos de prueba.
  await db.insert(movimientosFinancieros).values([
    {
      propiedadId: propiedad.id,
      tipo: "ingreso",
      categoria: "alquiler",
      monto: pago.monto,
      fecha: pago.fechaPago!,
      referenciaTipo: "pago",
      referenciaId: pago.id,
      descripcion: `Alquiler ${periodoActual} — ${juan.nombreCompleto}`,
    },
    {
      propiedadId: propiedad.id,
      tipo: "gasto",
      categoria: "otro",
      monto: "20000",
      fecha: sumarDiasISO(hoy, -10),
      descripcion: "Compra de bombita de luz de escalera",
    },
  ]);

  console.log("Listo. Datos de prueba cargados:");
  console.log(`  Propietario: ${propietario.nombreCompleto}`);
  console.log(`  Inquilino: ${juan.nombreCompleto} (garante: ${garante.nombreCompleto})`);
  console.log(`  Propiedad: ${propiedad.direccion}`);
  console.log(`  Gastos: ABL pendiente (id ${abl.id}), seguro hogar pagado`);
  console.log("  Seguro Finaer cargado en el contrato, vence en 10 días");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error al sembrar datos:", error);
    process.exit(1);
  });
