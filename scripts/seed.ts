import "dotenv/config";
import { db } from "../src/core/db/client.js";
import {
  contratos,
  contratosGarantes,
  impuestosServicios,
  pagos,
  personas,
  propiedades,
  reparaciones,
  seguros,
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
      .values({
        nombreCompleto: "Roberto Gómez",
        dni: "20123456",
        telefono: "1122334455",
        email: "roberto@example.com",
      })
      .returning(),
  );

  const juan = unico(
    await db
      .insert(personas)
      .values({ nombreCompleto: "Juan Pérez", dni: "30456789", telefono: "1155667788" })
      .returning(),
  );

  const maria = unico(
    await db
      .insert(personas)
      .values({ nombreCompleto: "María López", dni: "28998877", telefono: "1199887766" })
      .returning(),
  );

  const garante = unico(
    await db
      .insert(personas)
      .values({ nombreCompleto: "Carlos Ibáñez", dni: "25334455", telefono: "1166778899" })
      .returning(),
  );

  const propiedadCaseros = unico(
    await db
      .insert(propiedades)
      .values({ direccion: "Av. Rivadavia 1234", zona: "Caseros", propietarioId: propietario.id, tipo: "departamento" })
      .returning(),
  );

  const propiedadPalermo = unico(
    await db
      .insert(propiedades)
      .values({ direccion: "Guatemala 5678, 3B", zona: "Palermo", propietarioId: propietario.id, tipo: "departamento" })
      .returning(),
  );

  const propiedadBelgrano = unico(
    await db
      .insert(propiedades)
      .values({ direccion: "Cabildo 2500, 4A", zona: "Belgrano", propietarioId: propietario.id, tipo: "departamento" })
      .returning(),
  );

  const hoy = hoyISO();
  const periodoActual = hoy.slice(0, 7);

  const contratoJuan = unico(
    await db
      .insert(contratos)
      .values({
        propiedadId: propiedadCaseros.id,
        inquilinoId: juan.id,
        fechaInicio: sumarDiasISO(hoy, -180),
        fechaFin: sumarDiasISO(hoy, 185),
        valorAlquilerInicial: "150000",
        diaVencimientoPago: 10,
        indiceActualizacion: "ICL",
        deposito: "150000",
        estado: "vigente",
      })
      .returning(),
  );

  await db.insert(contratosGarantes).values({ contratoId: contratoJuan.id, personaId: garante.id });

  // Juan ya pagó el período actual → obtener_estado_pago debe mostrar "PAGADO".
  await db.insert(pagos).values({
    contratoId: contratoJuan.id,
    periodo: `${periodoActual}-01`,
    monto: "150000",
    fechaVencimiento: `${periodoActual}-10`,
    fechaPago: sumarDiasISO(hoy, -1),
    estado: "pagado",
    medioPago: "transferencia",
  });

  await db.insert(contratos).values({
    propiedadId: propiedadPalermo.id,
    inquilinoId: maria.id,
    fechaInicio: sumarDiasISO(hoy, -90),
    fechaFin: sumarDiasISO(hoy, 275),
    valorAlquilerInicial: "180000",
    diaVencimientoPago: 5,
    indiceActualizacion: "IPC",
    deposito: "180000",
    estado: "vigente",
  });
  // María no tiene recibo cargado para el período actual: si el día 5 ya pasó,
  // obtener_estado_pago / listar atrasados la va a mostrar como ATRASADO de forma automática.

  await db.insert(contratos).values({
    propiedadId: propiedadBelgrano.id,
    inquilinoId: maria.id,
    fechaInicio: sumarDiasISO(hoy, -300),
    fechaFin: sumarDiasISO(hoy, 15),
    valorAlquilerInicial: "200000",
    diaVencimientoPago: 1,
    indiceActualizacion: "ICL",
    deposito: "200000",
    estado: "vigente",
  });
  // Este contrato vence en 15 días → aparece en listar_vencimientos / el resumen de agenda.

  // Seguro por vencer en 20 días → aparece en la agenda y en "¿qué seguros tengo que renovar?".
  await db.insert(seguros).values({
    propiedadId: propiedadCaseros.id,
    compania: "La Caja",
    numeroPoliza: "POL-99887",
    fechaInicio: sumarDiasISO(hoy, -345),
    fechaVencimiento: sumarDiasISO(hoy, 20),
    costo: "45000",
  });

  // ABL por vencer en 8 días → aparece en la agenda / impuestos por vencer.
  await db.insert(impuestosServicios).values({
    propiedadId: propiedadPalermo.id,
    tipo: "ABL",
    numeroCuenta: "123-456789-0",
    fechaVencimiento: sumarDiasISO(hoy, 8),
    periodicidad: "bimestral",
    montoEstimado: "32000",
  });

  // Reparación abierta → aparece en la agenda / "¿qué reparaciones tengo abiertas?".
  await db.insert(reparaciones).values({
    propiedadId: propiedadBelgrano.id,
    fecha: sumarDiasISO(hoy, -3),
    descripcion: "Pérdida de agua en el baño",
    costo: "80000",
    estado: "pendiente",
  });

  console.log("Listo. Datos de prueba cargados:");
  console.log(`  Propietario: ${propietario.nombreCompleto}`);
  console.log(`  Inquilinos: ${juan.nombreCompleto}, ${maria.nombreCompleto}`);
  console.log(
    `  Propiedades: ${propiedadCaseros.direccion}, ${propiedadPalermo.direccion}, ${propiedadBelgrano.direccion}`,
  );
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error al sembrar datos:", error);
    process.exit(1);
  });
