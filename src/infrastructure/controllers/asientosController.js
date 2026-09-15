'use strict';

/**
 * Capa de Presentación (Infrastructure/HTTP) — traduce HTTP <-> caso de uso
 * para el bloqueo temporal de asientos (HU-02, SCRUM-8). No contiene lógica
 * de negocio ni SQL; solo valida presencia de parámetros y formatea la
 * respuesta.
 */

const { crearBloquearAsientoUseCase } = require('../../application/useCases/bloquearAsientoUseCase');
const asientosRepository = require('../repositories/asientosRepository');
const { ValidationError } = require('../../errors/AppError');

const bloquearAsientoUseCase = crearBloquearAsientoUseCase({ asientosRepository });

/**
 * POST /api/asientos/bloquear
 * Body: { vueloId, asientoId, usuarioId }
 *
 * En un sistema con autenticación real, `usuarioId` se tomaría de
 * `req.user.id` (middleware de auth previo), no del body.
 *
 * 200 OK       -> { status, code, data: { tiquete } }
 * 400          -> faltan datos en el body
 * 404          -> el asiento no existe / no pertenece al avión de ese vuelo
 * 409 Conflict -> el asiento ya fue bloqueado/reservado por otro usuario
 */
async function bloquearAsiento(req, res, next) {
  try {
    const { vueloId, asientoId, usuarioId } = req.body;

    if (!vueloId || !asientoId || !usuarioId) {
      throw new ValidationError(
        'vueloId, asientoId y usuarioId son obligatorios en el body.',
        'DATOS_INCOMPLETOS'
      );
    }

    const tiquete = await bloquearAsientoUseCase({ vueloId, asientoId, usuarioId });

    return res.status(200).json({
      status: 'success',
      code: 200,
      message: 'Asiento bloqueado temporalmente.',
      data: { tiquete },
    });
  } catch (error) {
    // Cualquier error (de negocio o inesperado) se delega al middleware
    // centralizado, nunca se formatea la respuesta de error aquí.
    return next(error);
  }
}

module.exports = { bloquearAsiento };
