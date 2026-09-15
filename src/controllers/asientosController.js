'use strict';

/**
 * Controlador HTTP para reserva de asientos. Delgado a propósito: toda la
 * lógica transaccional/de negocio vive en `services/asientosService.js`
 * (Clean Architecture — el controlador solo traduce HTTP <-> dominio).
 */

const asientosService = require('../services/asientosService');
const { ValidationError } = require('../errors/AppError');

/**
 * POST /api/vuelos/:vueloId/asientos/:asientoId/bloqueo
 * Body: { usuarioId }
 *
 * En un sistema con autenticación real, `usuarioId` se tomaría de
 * `req.user.id` (middleware de auth previo), no del body. Se acepta aquí
 * por body para mantener el endpoint auto-contenido dentro del alcance de
 * esta tarea (SCRUM-6, capa de concurrencia).
 */
async function bloquearAsiento(req, res, next) {
  try {
    const { vueloId, asientoId } = req.params;
    const { usuarioId } = req.body;

    if (!vueloId || !asientoId || !usuarioId) {
      throw new ValidationError(
        'vueloId (parámetro de ruta), asientoId (parámetro de ruta) y usuarioId (body) son obligatorios.',
        'DATOS_INCOMPLETOS'
      );
    }

    const tiquete = await asientosService.bloquearAsiento(vueloId, asientoId, usuarioId);

    return res.status(200).json({
      status: 'success',
      code: 200,
      message: 'Asiento reservado exitosamente.',
      data: { tiquete },
    });
  } catch (error) {
    // Cualquier error (de negocio o inesperado) se delega al middleware
    // centralizado, nunca se formatea la respuesta de error aquí.
    return next(error);
  }
}

module.exports = { bloquearAsiento };
