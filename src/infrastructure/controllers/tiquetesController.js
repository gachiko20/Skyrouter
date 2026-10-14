'use strict';

/**
 * Capa de Presentación (Infrastructure/HTTP) — traduce HTTP <-> caso de uso
 * para la descarga de documentos PDF de un tiquete (pase de abordar y
 * factura de compra). No contiene lógica de negocio ni SQL; solo valida el
 * parámetro de ruta, fija los headers de descarga y envía el stream.
 */

const PDFDocument = require('pdfkit');
const {
  crearGenerarPaseAbordarPdfUseCase,
} = require('../../application/useCases/generarPaseAbordarPdfUseCase');
const {
  crearGenerarFacturaPdfUseCase,
} = require('../../application/useCases/generarFacturaPdfUseCase');
const tiquetesRepository = require('../repositories/tiquetesRepository');
const { ValidationError } = require('../../errors/AppError');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const generarPaseAbordarPdfUseCase = crearGenerarPaseAbordarPdfUseCase({
  tiquetesRepository,
  PDFDocument,
});
const generarFacturaPdfUseCase = crearGenerarFacturaPdfUseCase({ tiquetesRepository, PDFDocument });

/**
 * Arma el handler de Express para un documento: valida el `:id`, delega en
 * el caso de uso (que autoriza: dueño, agente comercial o administrador) y
 * envía el PDF como adjunto con `doc.pipe(res)`.
 *
 * 200 OK -> application/pdf (attachment)
 * 400    -> `id` no es un UUID válido
 * 403    -> el tiquete pertenece a otro usuario y el rol no da acceso
 * 404    -> el tiquete no existe
 * 409    -> el estado del tiquete no permite emitir el documento
 */
function crearHandlerDescargaPdf(generarPdf, nombreArchivo) {
  return async function descargarPdf(req, res, next) {
    try {
      const { id } = req.params;

      // Sin esta validación, PostgreSQL rechazaría el cast a UUID con un 500.
      if (!UUID_REGEX.test(id)) {
        throw new ValidationError('El id del tiquete no es un UUID válido.', 'TIQUETE_ID_INVALIDO');
      }

      const doc = await generarPdf({ tiqueteId: id, solicitante: req.user });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
      doc.pipe(res);
    } catch (error) {
      // Cualquier error (de negocio o inesperado) se delega al middleware
      // centralizado, nunca se formatea la respuesta de error aquí.
      return next(error);
    }
  };
}

/** GET /api/tiquetes/:id/pase-abordar — protegida por `requireAuth`. */
const descargarPaseAbordar = crearHandlerDescargaPdf(
  generarPaseAbordarPdfUseCase,
  'pase_abordar_skyroute.pdf'
);

/** GET /api/tiquetes/:id/factura — protegida por `requireAuth`. */
const descargarFactura = crearHandlerDescargaPdf(generarFacturaPdfUseCase, 'factura_skyroute.pdf');

module.exports = { descargarPaseAbordar, descargarFactura };
