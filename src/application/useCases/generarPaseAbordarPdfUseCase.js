'use strict';

/**
 * Capa de Aplicación — caso de uso "Generar pase de abordar en PDF de un
 * tiquete".
 *
 * Mismo esquema que `generarFacturaPdfUseCase`: obtiene y autoriza el
 * tiquete (dueño, agente comercial o administrador), arma el documento con
 * el `PDFDocument` inyectado y lo devuelve finalizado como stream en
 * memoria para que el controlador haga `doc.pipe(res)`.
 */

const { ConflictError } = require('../../errors/AppError');
const {
  COLORES,
  crearDocumento,
  escribirEncabezado,
  escribirPie,
  escribirSeccion,
  formatearFechaHora,
  obtenerTiqueteAutorizado,
} = require('./documentosTiqueteComun');

const MENSAJE_PASE_NO_DISPONIBLE =
  'El pase de abordar solo está disponible para tiquetes confirmados o reagendados.';

/** Un tiquete PENDIENTE no está pago y uno CANCELADO no permite abordar. */
const ESTADOS_CON_PASE = ['CONFIRMADO', 'REAGENDADO'];

function construirPaseAbordar(doc, tiquete) {
  const { pasajero, vuelo, asiento } = tiquete;

  escribirEncabezado(doc, 'Pase de Abordar', `Vuelo ${vuelo.numeroVuelo}`);

  // Bloque principal: origen y destino grandes, como en un pase impreso.
  doc.roundedRect(50, 115, 495, 110, 8).fill(COLORES.primarioSuave);
  doc.font('Helvetica').fontSize(9).fillColor(COLORES.secundario);
  doc.text('ORIGEN', 80, 132);
  doc.text('DESTINO', 50, 132, { width: 465, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(40).fillColor(COLORES.texto);
  doc.text(vuelo.origen, 80, 148);
  doc.text(vuelo.destino, 50, 148, { width: 465, align: 'right' });
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(COLORES.primario)
    .text('- - - - - - - - - - - -', 50, 165, { width: 495, align: 'center' });

  // Código de reserva y asiento destacados.
  doc.font('Helvetica').fontSize(9).fillColor(COLORES.secundario);
  doc.text('CÓDIGO DE RESERVA', 50, 250);
  doc.text('ASIENTO', 50, 250, { width: 495, align: 'right' });
  doc.font('Courier-Bold').fontSize(28).fillColor(COLORES.primario).text(tiquete.codigoReserva, 50, 265);
  doc
    .font('Helvetica-Bold')
    .fontSize(28)
    .fillColor(COLORES.texto)
    .text(asiento.codigoAsiento, 50, 265, { width: 495, align: 'right' });

  escribirSeccion(
    doc,
    'Detalle del vuelo',
    [
      ['Pasajero', pasajero.nombreCompleto],
      ['Vuelo', vuelo.numeroVuelo],
      ['Ruta', `${vuelo.origen} - ${vuelo.destino}`],
      ['Fecha y hora de salida', formatearFechaHora(vuelo.fechaHoraSalida)],
      ['Llegada estimada', formatearFechaHora(vuelo.fechaHoraLlegada)],
      ['Asiento', `${asiento.codigoAsiento} (${asiento.clase})`],
    ],
    320
  );

  escribirPie(
    doc,
    'Preséntate en la sala de abordaje con este pase y tu documento de identidad. Horas en hora de Colombia.'
  );
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
function crearGenerarPaseAbordarPdfUseCase({ tiquetesRepository, PDFDocument }) {
  return async function generarPaseAbordarPdf({ tiqueteId, solicitante }) {
    const tiquete = await obtenerTiqueteAutorizado({ tiquetesRepository, tiqueteId, solicitante });

    if (!ESTADOS_CON_PASE.includes(tiquete.estado)) {
      throw new ConflictError(MENSAJE_PASE_NO_DISPONIBLE, 'PASE_ABORDAR_NO_DISPONIBLE');
    }

    const doc = crearDocumento(PDFDocument, `Pase de Abordar SkyRoute ${tiquete.codigoReserva}`);
    construirPaseAbordar(doc, tiquete);
    doc.end();

    return doc;
  };
}

module.exports = { crearGenerarPaseAbordarPdfUseCase };
