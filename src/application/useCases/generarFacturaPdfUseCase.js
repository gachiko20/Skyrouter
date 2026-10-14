'use strict';

/**
 * Capa de Aplicación — caso de uso "Generar factura de compra en PDF de un
 * tiquete".
 *
 * Orquesta: obtiene y autoriza el tiquete (dueño, agente comercial o
 * administrador, ver `documentosTiqueteComun`) y arma el documento con
 * `pdfkit`. El repositorio y el constructor `PDFDocument` se reciben por
 * parámetro (inyección de dependencias, igual que `bcrypt` en
 * `actualizarPasswordUsuarioUseCase`) para que este caso de uso sea
 * testeable sin PostgreSQL ni escritura real de PDFs.
 *
 * Devuelve el documento ya finalizado (`doc.end()`): es un Readable stream
 * que bufferiza su contenido hasta que alguien lo consuma, así que el
 * controlador puede hacer `doc.pipe(res)` después sin perder datos. El PDF
 * nunca toca disco.
 */

const { ConflictError } = require('../../errors/AppError');
const {
  COLORES,
  crearDocumento,
  escribirEncabezado,
  escribirPie,
  escribirSeccion,
  formatearFechaHora,
  formatearMoneda,
  obtenerTiqueteAutorizado,
} = require('./documentosTiqueteComun');

const MENSAJE_FACTURA_NO_DISPONIBLE =
  'La factura solo está disponible para tiquetes pagados (la reserva sigue pendiente de pago).';

/**
 * IVA aplicado a tiquetes aéreos nacionales en Colombia. El esquema solo
 * guarda `precio_pagado` (total), así que el desglose se deriva de él
 * asumiendo que ese total ya incluye el IVA.
 */
const TASA_IVA = 0.19;

/** Divide el total pagado en subtotal (tarifa sin IVA) + IVA, redondeado a centavos. */
function calcularDesglose(total) {
  const subtotal = Math.round((total / (1 + TASA_IVA)) * 100) / 100;
  const iva = Math.round((total - subtotal) * 100) / 100;
  return { subtotal, iva, total };
}

function construirFactura(doc, tiquete) {
  const { pasajero, vuelo, asiento } = tiquete;
  const desglose = calcularDesglose(tiquete.precioPagado);

  escribirEncabezado(doc, 'Factura de Compra', `Reserva ${tiquete.codigoReserva}`);

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLORES.secundario)
    .text(`Fecha de emisión: ${formatearFechaHora(new Date())}`, 50, 110)
    .text(`Fecha de compra: ${formatearFechaHora(tiquete.fechaReserva)}`, 50, 124);

  let y = escribirSeccion(
    doc,
    'Datos del pasajero',
    [
      ['Nombre', pasajero.nombreCompleto],
      ['Correo electrónico', pasajero.correo],
      ['Documento de identidad', pasajero.documentoIdentidad],
    ],
    160
  );

  y = escribirSeccion(
    doc,
    'Detalle del vuelo',
    [
      ['Número de vuelo', vuelo.numeroVuelo],
      ['Ruta', `${vuelo.origen} - ${vuelo.destino}`],
      ['Salida', formatearFechaHora(vuelo.fechaHoraSalida)],
      ['Asiento', `${asiento.codigoAsiento} (${asiento.clase})`],
      ['Estado del tiquete', tiquete.estado],
    ],
    y
  );

  y = escribirSeccion(
    doc,
    'Desglose del precio',
    [
      [`Tarifa aérea (sin IVA)`, formatearMoneda(desglose.subtotal)],
      [`IVA (${TASA_IVA * 100}%)`, formatearMoneda(desglose.iva)],
    ],
    y
  );

  // Total pagado, resaltado.
  doc.roundedRect(50, y, 495, 50, 6).fill(COLORES.primarioSuave);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORES.texto).text('Total pagado', 70, y + 18);
  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor(COLORES.primario)
    .text(formatearMoneda(desglose.total), 220, y + 15, { width: 305, align: 'right' });

  escribirPie(doc, 'Este documento es un comprobante de pago generado automáticamente por SkyRoute.');
}

/**
 * @param {{
 *   tiquetesRepository: { obtenerDatosFactura: Function },
 *   PDFDocument: typeof import('pdfkit'),
 * }} dependencias
 * @returns {(datos: {
 *   tiqueteId: string,
 *   solicitante: { idUsuario: string, rol: string },
 * }) => Promise<import('pdfkit')>}
 */
function crearGenerarFacturaPdfUseCase({ tiquetesRepository, PDFDocument }) {
  return async function generarFacturaPdf({ tiqueteId, solicitante }) {
    const tiquete = await obtenerTiqueteAutorizado({ tiquetesRepository, tiqueteId, solicitante });

    // PENDIENTE = bloqueo temporal de HU-02 sin pago: no hay nada que facturar.
    if (tiquete.estado === 'PENDIENTE') {
      throw new ConflictError(MENSAJE_FACTURA_NO_DISPONIBLE, 'FACTURA_NO_DISPONIBLE');
    }

    const doc = crearDocumento(PDFDocument, `Factura de Compra SkyRoute ${tiquete.codigoReserva}`);
    construirFactura(doc, tiquete);
    doc.end();

    return doc;
  };
}

module.exports = { crearGenerarFacturaPdfUseCase, calcularDesglose };
