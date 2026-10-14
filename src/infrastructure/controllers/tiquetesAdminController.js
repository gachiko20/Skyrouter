'use strict';

/**
 * Capa de Presentación (Infrastructure/HTTP) — traduce HTTP <-> caso de uso
 * para la gestión administrativa de tiquetes (SCRUM-10: cancelación y
 * reagendamiento por un agente comercial o administrador). No contiene
 * lógica de negocio ni SQL; solo valida presencia de parámetros y formatea
 * la respuesta.
 */

const {
  crearGestionarTiqueteAdminUseCase,
} = require('../../application/useCases/gestionarTiqueteAdminUseCase');
const {
  crearBuscarTiquetesAdminUseCase,
} = require('../../application/useCases/buscarTiquetesAdminUseCase');
const tiquetesAdminRepository = require('../repositories/tiquetesAdminRepository');
const { emitirAsientosActualizados } = require('../websocket/socketServer');
const { ValidationError } = require('../../errors/AppError');

const gestionarTiqueteAdminUseCase = crearGestionarTiqueteAdminUseCase({ tiquetesAdminRepository });
const buscarTiquetesAdminUseCase = crearBuscarTiquetesAdminUseCase({ tiquetesAdminRepository });

const MENSAJES_EXITO = {
  CANCELADO: 'Tiquete cancelado correctamente.',
  REAGENDADO: 'Tiquete reagendado correctamente.',
};

/**
 * PATCH /api/admin/tiquetes/:id/estado
 * Body:
 *   - Cancelar:  { estado: 'CANCELADO' }
 *   - Reagendar: { estado: 'REAGENDADO', nuevoVueloId, nuevoAsientoId }
 * Protegida por `requireAuth` + `requireRole(['administrador', 'agente_comercial'])`
 * (ver `infrastructure/routes/adminRoutes.js`).
 *
 * `idAgente` SIEMPRE se toma de `req.user.idUsuario` (el JWT verificado),
 * nunca del body — mismo motivo que en `asientosController`/
 * `checkoutController`: deja registrado de forma confiable qué agente/
 * administrador gestionó el tiquete (columna `tiquetes.id_agente`).
 *
 * 200 OK       -> { status, code, message, data: { tiquete } }
 * 400          -> falta "estado", es inválido, o falta nuevoVueloId/nuevoAsientoId al reagendar
 * 404          -> el tiquete (o, al reagendar, el nuevo asiento) no existe
 * 409 Conflict -> el tiquete ya está cancelado, o el nuevo asiento ya no está disponible
 */
async function actualizarEstadoTiquete(req, res, next) {
  try {
    const { id } = req.params;
    const { estado, nuevoVueloId, nuevoAsientoId } = req.body;
    const idAgente = req.user.idUsuario;

    if (!estado) {
      throw new ValidationError('"estado" es obligatorio en el body.', 'DATOS_INCOMPLETOS');
    }

    const { tiquete, vuelosAfectados } = await gestionarTiqueteAdminUseCase({
      idTiquete: id,
      estado,
      nuevoVueloId,
      nuevoAsientoId,
      idAgente,
    });

    // No se espera (await) a propósito, mismo patrón que
    // asientosController/checkoutController: la respuesta al agente no debe
    // demorarse por notificar a los demás clientes conectados a cada sala
    // (errores de emisión ya se registran internamente y nunca rompen esta
    // request). Puede ser 1 vuelo (cancelar) o 2 (reagendar entre vuelos
    // distintos) — ambos mapas de asientos deben refrescarse en vivo.
    vuelosAfectados.forEach((vueloId) => emitirAsientosActualizados(vueloId));

    return res.status(200).json({
      status: 'success',
      code: 200,
      message: MENSAJES_EXITO[estado] || 'Tiquete actualizado correctamente.',
      data: { tiquete },
    });
  } catch (error) {
    // Cualquier error (de negocio o inesperado) se delega al middleware
    // centralizado, nunca se formatea la respuesta de error aquí.
    return next(error);
  }
}

/**
 * GET /api/admin/tiquetes?codigoReserva=...|?documento=...
 * Protegida por `requireAuth` + `requireRole(['administrador', 'agente_comercial'])`.
 * Buscador básico: exige al menos uno de los dos criterios.
 *
 * 200 OK -> { status, code, data: { tiquetes: [{
 *   idTiquete, codigoReserva, estado, precioPagado, numeroVuelo, origen,
 *   destino, fechaHoraSalida, codigoAsiento, nombrePasajero,
 *   documentoPasajero, correoPasajero
 * }] } }
 * 400    -> no se indicó codigoReserva ni documento
 */
async function buscarTiquetes(req, res, next) {
  try {
    const { codigoReserva, documento } = req.query;

    const tiquetes = await buscarTiquetesAdminUseCase({ codigoReserva, documento });

    return res.status(200).json({
      status: 'success',
      code: 200,
      data: { tiquetes },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { actualizarEstadoTiquete, buscarTiquetes };
