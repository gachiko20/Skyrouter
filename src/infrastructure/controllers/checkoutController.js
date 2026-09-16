'use strict';

/**
 * Capa de Presentación (Infrastructure/HTTP) — traduce HTTP <-> caso de uso
 * para el checkout de pago (procesamiento de pago simulado + confirmación
 * de reserva). No contiene lógica de negocio ni SQL; solo valida presencia
 * de parámetros y formatea la respuesta.
 */

const { crearCheckoutUseCase } = require('../../application/useCases/checkoutUseCase');
const tiquetesRepository = require('../repositories/tiquetesRepository');
const { ValidationError } = require('../../errors/AppError');

const checkoutUseCase = crearCheckoutUseCase({ tiquetesRepository });

/**
 * POST /api/tiquetes/checkout
 * Body: {
 *   vueloId, asientoId, pasajeroId,
 *   datosPasajero: { nombreCompleto, correo, telefono, pasaporte },
 *   datosPago: { numeroTarjeta, fechaExpiracion, cvv, nombreTitular }
 * }
 *
 * `datosPasajero` se recibe y valida (contacto del comprador) pero no se
 * persiste: el esquema actual (`database/init.sql`) vincula el tiquete a un
 * `usuarios` ya existente vía `pasajeroId`, no guarda un snapshot de
 * contacto por tiquete. En un sistema con autenticación real, `pasajeroId`
 * se tomaría de `req.user.id`, no del body.
 *
 * 200 OK       -> { status, code, message, data: { tiquete } }
 * 400          -> faltan datos en el body, o datos de tarjeta incompletos
 * 404          -> el asiento o el pasajero no existen
 * 409 Conflict -> el asiento ya fue reservado/comprado por otro pasajero
 */
async function checkout(req, res, next) {
  try {
    const { vueloId, asientoId, pasajeroId, datosPasajero, datosPago } = req.body;

    if (!vueloId || !asientoId || !pasajeroId || !datosPasajero || !datosPago) {
      throw new ValidationError(
        'vueloId, asientoId, pasajeroId, datosPasajero y datosPago son obligatorios en el body.',
        'DATOS_INCOMPLETOS'
      );
    }

    const camposPasajeroFaltantes = ['nombreCompleto', 'correo', 'telefono', 'pasaporte'].filter(
      (campo) => !String(datosPasajero[campo] ?? '').trim()
    );

    if (camposPasajeroFaltantes.length > 0) {
      throw new ValidationError(
        `datosPasajero incompleto: falta(n) ${camposPasajeroFaltantes.join(', ')}.`,
        'DATOS_PASAJERO_INCOMPLETOS'
      );
    }

    const tiquete = await checkoutUseCase({ vueloId, asientoId, pasajeroId, datosPago });

    return res.status(200).json({
      status: 'success',
      code: 200,
      message: 'Pago procesado y reserva confirmada exitosamente.',
      data: { tiquete },
    });
  } catch (error) {
    // Cualquier error (de negocio o inesperado) se delega al middleware
    // centralizado, nunca se formatea la respuesta de error aquí.
    return next(error);
  }
}

module.exports = { checkout };
