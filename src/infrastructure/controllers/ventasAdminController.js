'use strict';

/**
 * Capa de Presentación (Infrastructure/HTTP) — traduce HTTP <-> caso de uso
 * para la venta de tiquetes en mostrador (agente comercial/administrador).
 * No contiene lógica de negocio ni SQL.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const {
  crearRegistrarVentaAdminUseCase,
} = require('../../application/useCases/registrarVentaAdminUseCase');
const ventasAdminRepository = require('../repositories/ventasAdminRepository');
const { emitirAsientosActualizados } = require('../websocket/socketServer');

const registrarVentaAdminUseCase = crearRegistrarVentaAdminUseCase({
  ventasAdminRepository,
  bcrypt,
  generarSecretoAleatorio: () => crypto.randomBytes(32).toString('hex'),
});

/**
 * POST /api/admin/ventas
 * Body: {
 *   vueloId, asientoId,
 *   pasajero: { documento, nombres, apellidos, correo, telefono? }
 * }
 * Protegida por `requireAuth` + `requireRole(['administrador', 'agente_comercial'])`.
 *
 * `idAgente` SIEMPRE sale de `req.user.idUsuario` (JWT verificado), nunca
 * del body: es el dato de auditoría de quién vendió.
 *
 * 201 Created -> { status, code, message, data: { tiquete, pasajeroCreado } }
 * 400         -> datos incompletos o con formato inválido
 * 404         -> el asiento no existe / no es de ese vuelo
 * 409         -> asiento ocupado, vuelo no vendible o correo de otro pasajero
 */
async function registrarVenta(req, res, next) {
  try {
    const { vueloId, asientoId, pasajero } = req.body;

    const { tiquete, pasajeroCreado } = await registrarVentaAdminUseCase({
      vueloId,
      asientoId,
      pasajero,
      idAgente: req.user.idUsuario,
    });

    // Igual que el checkout: no se espera, para no demorar la respuesta.
    emitirAsientosActualizados(vueloId);

    return res.status(201).json({
      status: 'success',
      code: 201,
      message: 'Venta registrada exitosamente.',
      data: { tiquete, pasajeroCreado },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { registrarVenta };
