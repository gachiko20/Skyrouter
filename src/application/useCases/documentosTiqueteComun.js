'use strict';

/**
 * Capa de Aplicación — piezas compartidas por los casos de uso que generan
 * documentos PDF de un tiquete (`generarPaseAbordarPdfUseCase`,
 * `generarFacturaPdfUseCase`): obtención + autorización del tiquete y los
 * bloques de diseño comunes (encabezado, secciones, pie), para que ambos
 * documentos compartan identidad visual sin duplicar código.
 */

const { ForbiddenError, NotFoundError } = require('../../errors/AppError');

const MENSAJE_TIQUETE_NO_ENCONTRADO = 'El tiquete indicado no existe.';
const MENSAJE_TIQUETE_AJENO = 'No puedes descargar documentos de un tiquete de otro usuario.';

/** Roles que pueden descargar documentos de tiquetes ajenos. */
const ROLES_CON_ACCESO_TOTAL = ['agente_comercial', 'administrador'];

const COLORES = {
  primario: '#0284c7', // sky-600, mismo acento del frontend
  primarioSuave: '#f0f9ff', // sky-50
  textoSobrePrimario: '#e0f2fe', // sky-100
  texto: '#1e293b', // slate-800
  secundario: '#64748b', // slate-500
  borde: '#e2e8f0', // slate-200
};

const formateadorFechaHora = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
});

const formateadorMoneda = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
});

function formatearFechaHora(fecha) {
  return formateadorFechaHora.format(new Date(fecha));
}

function formatearMoneda(valor) {
  return formateadorMoneda.format(valor);
}

/**
 * Obtiene los datos del tiquete y valida que el solicitante sea su dueño,
 * un agente comercial o un administrador.
 *
 * @throws {NotFoundError} si el tiquete no existe.
 * @throws {ForbiddenError} si el tiquete es de otro usuario y el rol no da acceso.
 */
async function obtenerTiqueteAutorizado({ tiquetesRepository, tiqueteId, solicitante }) {
  const tiquete = await tiquetesRepository.obtenerDatosFactura(tiqueteId);

  if (!tiquete) {
    throw new NotFoundError(MENSAJE_TIQUETE_NO_ENCONTRADO, 'TIQUETE_NO_ENCONTRADO');
  }

  const esDuenio = tiquete.idPasajero === solicitante.idUsuario;
  const tieneAccesoTotal = ROLES_CON_ACCESO_TOTAL.includes(solicitante.rol);

  if (!esDuenio && !tieneAccesoTotal) {
    throw new ForbiddenError(MENSAJE_TIQUETE_AJENO, 'TIQUETE_AJENO');
  }

  return tiquete;
}

/** Banda superior con la marca SkyRoute y el título del documento a la derecha. */
function escribirEncabezado(doc, titulo, subtitulo) {
  doc.rect(0, 0, doc.page.width, 90).fill(COLORES.primario);
  doc.font('Helvetica-Bold').fontSize(26).fillColor('#ffffff').text('SkyRoute', 50, 28);
  doc.font('Helvetica').fontSize(10).fillColor(COLORES.textoSobrePrimario).text('Sky Rout Operations', 50, 58);
  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#ffffff')
    .text(titulo, 50, 30, { width: 495, align: 'right' });
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLORES.textoSobrePrimario)
    .text(subtitulo, 50, 52, { width: 495, align: 'right' });
}

/** Fila "etiqueta ........ valor" dentro de una sección. */
function escribirFila(doc, etiqueta, valor, y) {
  doc.font('Helvetica').fontSize(10).fillColor(COLORES.secundario).text(etiqueta, 60, y);
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(COLORES.texto)
    .text(String(valor ?? '—'), 220, y, { width: 315, align: 'right' });
}

/** Título de sección con línea divisoria y sus filas. Devuelve la `y` siguiente. */
function escribirSeccion(doc, titulo, filas, yInicial) {
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORES.primario).text(titulo, 50, yInicial);
  doc
    .moveTo(50, yInicial + 18)
    .lineTo(545, yInicial + 18)
    .strokeColor(COLORES.borde)
    .lineWidth(1)
    .stroke();

  let y = yInicial + 28;
  filas.forEach(([etiqueta, valor]) => {
    escribirFila(doc, etiqueta, valor, y);
    y += 20;
  });
  return y + 12;
}

/** Nota centrada al pie de la página. */
function escribirPie(doc, texto) {
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLORES.secundario)
    .text(texto, 50, doc.page.height - 80, { width: 495, align: 'center' });
}

/** Crea el documento A4 con metadatos. El llamador lo llena y hace `doc.end()`. */
function crearDocumento(PDFDocument, titulo) {
  return new PDFDocument({
    size: 'A4',
    margin: 50,
    info: { Title: titulo, Author: 'SkyRoute' },
  });
}

module.exports = {
  COLORES,
  crearDocumento,
  escribirEncabezado,
  escribirPie,
  escribirSeccion,
  formatearFechaHora,
  formatearMoneda,
  obtenerTiqueteAutorizado,
};
