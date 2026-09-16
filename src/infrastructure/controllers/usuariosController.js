'use strict';

/**
 * Capa de Presentación (Infrastructure/HTTP) — traduce HTTP <-> caso de uso
 * para el historial de vuelos de un usuario. No contiene lógica de negocio
 * ni SQL; solo extrae el parámetro de ruta y formatea la respuesta.
 */

const {
  crearObtenerHistorialVuelosUseCase,
} = require('../../application/useCases/obtenerHistorialVuelosUseCase');
const usuariosRepository = require('../repositories/usuariosRepository');

const obtenerHistorialVuelosUseCase = crearObtenerHistorialVuelosUseCase({ usuariosRepository });

/**
 * GET /api/usuarios/:id/historial
 *
 * En un sistema con autenticación real, `id` debería además verificarse
 * contra `req.user.id` (o el rol del solicitante) para que un usuario no
 * pueda consultar el historial de otro; queda fuera de alcance hasta que
 * exista un middleware de auth (mismo TODO que `pasajeroId` en
 * `checkoutController`).
 *
 * 200 OK -> { status, code, data: { historial: [{
 *              idTiquete, codigoReserva, numeroVuelo, origen, destino, ruta,
 *              fechaHoraSalida, fechaHoraLlegada,
 *              asiento: { codigoAsiento, clase },
 *              estado, precioPagado, fechaReserva
 *            }] } }
 * 404    -> el usuario indicado no existe
 */
async function obtenerHistorialVuelos(req, res, next) {
  try {
    const { id } = req.params;

    const historial = await obtenerHistorialVuelosUseCase(id);

    return res.status(200).json({
      status: 'success',
      code: 200,
      data: { historial },
    });
  } catch (error) {
    // Cualquier error (de negocio o inesperado) se delega al middleware
    // centralizado, nunca se formatea la respuesta de error aquí.
    return next(error);
  }
}

module.exports = { obtenerHistorialVuelos };
