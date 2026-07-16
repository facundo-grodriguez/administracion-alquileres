import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/core/db/client.js";
import {
  contratos,
  contratosGarantes,
  documentos,
  impuestosServicios,
  movimientosFinancieros,
  pagos,
  personas,
  propiedades,
  proveedores,
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

  const plomero = unico(
    await db
      .insert(proveedores)
      .values({
        nombre: "Plomería Fontana",
        categoria: "plomero",
        telefono: "1144556677",
        zona: "Caseros",
        horarios: "Lun a Vie 8 a 18hs",
        confianza: 5,
        observaciones: "Responde rápido, buenos precios",
      })
      .returning(),
  );

  const gasista = unico(
    await db
      .insert(proveedores)
      .values({ nombre: "Gas Sur", categoria: "gasista", telefono: "1155889900", zona: "Palermo", confianza: 4 })
      .returning(),
  );

  const propiedadCaseros = unico(
    await db
      .insert(propiedades)
      .values({
        direccion: "Av. Rivadavia 1234",
        zona: "Caseros",
        propietarioId: propietario.id,
        tipo: "departamento",
        carpetaDriveUrl: "https://drive.google.com/drive/folders/ejemplo-caseros",
      })
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
  const pagoJuan = unico(
    await db
      .insert(pagos)
      .values({
        contratoId: contratoJuan.id,
        periodo: `${periodoActual}-01`,
        monto: "150000",
        fechaVencimiento: `${periodoActual}-10`,
        fechaPago: sumarDiasISO(hoy, -1),
        estado: "pagado",
        medioPago: "transferencia",
      })
      .returning(),
  );

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

  // ABL por vencer en 8 días, a cargo del propietario → aparece en la agenda / impuestos por vencer.
  await db.insert(impuestosServicios).values({
    propiedadId: propiedadPalermo.id,
    tipo: "ABL",
    responsable: "propietario",
    numeroCuenta: "123-456789-0",
    fechaVencimiento: sumarDiasISO(hoy, 8),
    periodicidad: "bimestral",
    montoEstimado: "32000",
  });

  // Internet a cargo del inquilino → ejemplo de obligación con responsable distinto al ABL.
  await db.insert(impuestosServicios).values({
    propiedadId: propiedadPalermo.id,
    tipo: "internet",
    responsable: "inquilino",
    fechaVencimiento: sumarDiasISO(hoy, 12),
    periodicidad: "mensual",
    montoEstimado: "18000",
  });

  // Reparación abierta, con proveedor asignado → aparece en la agenda / "¿qué reparaciones tengo abiertas?".
  const reparacionBano = unico(
    await db
      .insert(reparaciones)
      .values({
        propiedadId: propiedadBelgrano.id,
        proveedorId: plomero.id,
        fecha: sumarDiasISO(hoy, -3),
        descripcion: "Pérdida de agua en el baño",
        costo: "80000",
        estado: "pendiente",
      })
      .returning(),
  );

  // Documento puntual de una propiedad (contrato) y comprobante de la reparación anterior.
  await db.insert(documentos).values({
    entidadTipo: "propiedad",
    entidadId: propiedadCaseros.id,
    tipoDocumento: "contrato",
    storagePath: "https://drive.google.com/file/d/ejemplo-contrato-caseros/view",
    nombreArchivo: "Contrato_Caseros.pdf",
  });

  const comprobante = unico(
    await db
      .insert(documentos)
      .values({
        entidadTipo: "reparacion",
        entidadId: reparacionBano.id,
        tipoDocumento: "comprobante",
        storagePath: "https://drive.google.com/file/d/ejemplo-factura-plomeria/view",
        nombreArchivo: "Factura_Plomeria.pdf",
      })
      .returning(),
  );
  await db
    .update(reparaciones)
    .set({ comprobanteDocumentoId: comprobante.id })
    .where(eq(reparaciones.id, reparacionBano.id));

  // Movimientos financieros: dos "espejo" de lo que generaría el flujo real (pago + reparación
  // con costo) más uno manual, para tener ambos casos representados en los datos de prueba.
  await db.insert(movimientosFinancieros).values([
    {
      propiedadId: propiedadCaseros.id,
      tipo: "ingreso",
      categoria: "alquiler",
      monto: pagoJuan.monto,
      fecha: pagoJuan.fechaPago!,
      referenciaTipo: "pago",
      referenciaId: pagoJuan.id,
      descripcion: `Alquiler ${periodoActual} — ${juan.nombreCompleto}`,
    },
    {
      propiedadId: propiedadBelgrano.id,
      tipo: "gasto",
      categoria: "reparacion",
      monto: reparacionBano.costo!,
      fecha: reparacionBano.fecha,
      referenciaTipo: "reparacion",
      referenciaId: reparacionBano.id,
      descripcion: reparacionBano.descripcion,
    },
    {
      propiedadId: propiedadPalermo.id,
      tipo: "gasto",
      categoria: "otro",
      monto: "95000",
      fecha: sumarDiasISO(hoy, -10),
      descripcion: "Compra de aire acondicionado",
    },
  ]);

  console.log("Listo. Datos de prueba cargados:");
  console.log(`  Propietario: ${propietario.nombreCompleto}`);
  console.log(`  Inquilinos: ${juan.nombreCompleto}, ${maria.nombreCompleto}`);
  console.log(
    `  Propiedades: ${propiedadCaseros.direccion}, ${propiedadPalermo.direccion}, ${propiedadBelgrano.direccion}`,
  );
  console.log(`  Proveedores: ${plomero.nombre}, ${gasista.nombre}`);
  console.log("  Documentos: contrato de Caseros, comprobante de la reparación de Belgrano");
  console.log("  Movimientos financieros: 3 (alquiler cobrado, reparación, gasto manual)");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error al sembrar datos:", error);
    process.exit(1);
  });
