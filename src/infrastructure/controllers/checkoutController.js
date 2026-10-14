'use strict';

/**
 * Capa de Presentación (Infrastructure/HTTP) — traduce HTTP <-> caso de uso
 * para el checkout de pago (procesamiento de pago simulado + confirmación
 * de reserva). No contiene lógica de negocio ni SQL; solo valida presencia
 * de parámetros y formatea la respuesta.
 */

const { crearCheckoutUseCase } = require('../../application/useCases/checkoutUseCase');
const tiquetesRepository = require('../repositories/tiquetesRepository');
const { emitirAsientosActualizados } = require('../websocket/socketServer');
const { ValidationError } = require('../../errors/AppError');

const checkoutUseCase = crearCheckoutUseCase({ tiquetesRepository });

/**
 * POST /api/tiquetes/checkout
 * Body: {
 *   vueloId, asientoId,
 *   datosPasajero: { nombreCompleto, correo, telefono, pasaporte },
 *   datosPago: { numeroTarjeta, fechaExpiracion, cvv, nombreTitular }
 * }
 * Protegida por `requireAuth` (ver `infrastructure/routes/tiquetesRoutes.js`).
 *
 * `datosPasajero` se recibe y valida (contacto del comprador) pero no se
 * persiste: el esquema actual (`database/init.sql`) vincula el tiquete a un
 * `usuarios` ya existente vía `pasajeroId`, no guarda un snapshot de
 * contacto por tiquete.
 *
 * `pasajeroId` SIEMPRE se toma de `req.user.idUsuario` (el JWT verificado),
 * nunca del body — mismo motivo que `asientosController.bloquearAsiento`:
 * de lo contrario cualquier cliente autenticado podría pagar/confirmar una
 * reserva a nombre de OTRO usuario. Completa el TODO que dejó pendiente la
 * implementación original del checkout antes de que existiera SCRUM-49.
 *
 * 200 OK       -> { status, code, message, data: { tiquete } }
 * 400          -> faltan datos en el body, o datos de tarjeta incompletos
 * 404          -> el asiento o el pasajero no existen
 * 409 Conflict -> el asiento ya fue reservado/comprado por otro pasajero
 */
async function checkout(req, res, next) {
  try {
    const { vueloId, asientoId, datosPasajero, datosPago } = req.body;
    const pasajeroId = req.user.idUsuario;

    if (!vueloId || !asientoId || !datosPasajero || !datosPago) {
      throw new ValidationError(
        'vueloId, asientoId, datosPasajero y datosPago son obligatorios en el body.',
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

    // Igual que en `asientosController.bloquearAsiento`: no se espera, para
    // no demorar la respuesta de pago por la notificación a otros clientes.
    emitirAsientosActualizados(vueloId);

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
