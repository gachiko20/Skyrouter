'use strict';

/**
 * Capa de Presentación (Infrastructure/HTTP) — traduce HTTP <-> caso de uso
 * para el historial de vuelos de un usuario. No contiene lógica de negocio
 * ni SQL; solo extrae el parámetro de ruta y formatea la respuesta.
 */

const bcrypt = require('bcryptjs');
const {
  crearObtenerHistorialVuelosUseCase,
} = require('../../application/useCases/obtenerHistorialVuelosUseCase');
const {
  crearObtenerPerfilUsuarioUseCase,
} = require('../../application/useCases/obtenerPerfilUsuarioUseCase');
const {
  crearActualizarPasswordUsuarioUseCase,
} = require('../../application/useCases/actualizarPasswordUsuarioUseCase');
const usuariosRepository = require('../repositories/usuariosRepository');
const { ForbiddenError } = require('../../errors/AppError');

const MENSAJE_PERFIL_AJENO = 'No puedes consultar los datos de otro usuario.';
const MENSAJE_PASSWORD_AJENA = 'No puedes cambiar la contraseña de otro usuario.';

/** Dueño del recurso (`req.user.idUsuario === id`) o administrador. */
function esDuenioOAdministrador(req, id) {
  return req.user.idUsuario === id || req.user.rol === 'administrador';
}

const obtenerHistorialVuelosUseCase = crearObtenerHistorialVuelosUseCase({ usuariosRepository });
const obtenerPerfilUsuarioUseCase = crearObtenerPerfilUsuarioUseCase({ usuariosRepository });
const actualizarPasswordUsuarioUseCase = crearActualizarPasswordUsuarioUseCase({
  usuariosRepository,
  bcrypt,
});

/**
 * GET /api/usuarios/:id/historial
 * Protegida por `requireAuth` (ver `usuariosRoutes.js`). Solo el dueño del
 * historial o un administrador pueden consultarlo.
 *
 * 200 OK -> { status, code, data: { historial: [{
 *              idTiquete, codigoReserva, numeroVuelo, origen, destino, ruta,
 *              fechaHoraSalida, fechaHoraLlegada,
 *              asiento: { codigoAsiento, clase },
 *              estado, precioPagado, fechaReserva
 *            }] } }
 * 403    -> intenta consultar el historial de otro usuario
 * 404    -> el usuario indicado no existe
 */
async function obtenerHistorialVuelos(req, res, next) {
  try {
    const { id } = req.params;

    if (!esDuenioOAdministrador(req, id)) {
      throw new ForbiddenError(MENSAJE_PERFIL_AJENO, 'PERFIL_AJENO');
    }

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

/**
 * GET /api/usuarios/:id
 * Protegida por `requireAuth`. Solo el dueño del perfil o un administrador
 * pueden consultarlo.
 *
 * 200 OK -> { status, code, data: { usuario: {
 *              idUsuario, nombreCompleto, correo, telefono, rol
 *            } } }
 * 403    -> intenta consultar el perfil de otro usuario
 * 404    -> el usuario indicado no existe
 */
async function obtenerUsuario(req, res, next) {
  try {
    const { id } = req.params;

    if (!esDuenioOAdministrador(req, id)) {
      throw new ForbiddenError(MENSAJE_PERFIL_AJENO, 'PERFIL_AJENO');
    }

    const usuario = await obtenerPerfilUsuarioUseCase(id);

    return res.status(200).json({
      status: 'success',
      code: 200,
      data: { usuario },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /api/usuarios/:id/password
 * Body: { passwordActual, passwordNueva }
 * Protegida por `requireAuth`. A diferencia de `obtenerUsuario`/
 * `obtenerHistorialVuelos`, aquí NO se admite la excepción de
 * administrador: cambiar la contraseña exige conocer la actual
 * (`bcrypt.compare` en `actualizarPasswordUsuarioUseCase`), algo que un
 * administrador tampoco tiene — por diseño, esto solo lo puede hacer el
 * propio dueño de la cuenta.
 *
 * 200 OK -> { status, code, message }
 * 400    -> datos incompletos o nueva contraseña inválida
 * 401    -> la contraseña actual no coincide con el hash persistido
 * 403    -> intenta cambiar la contraseña de otro usuario
 * 404    -> el usuario indicado no existe
 */
async function actualizarPassword(req, res, next) {
  try {
    const { id } = req.params;
    const { passwordActual, passwordNueva } = req.body;

    if (req.user.idUsuario !== id) {
      throw new ForbiddenError(MENSAJE_PASSWORD_AJENA, 'PASSWORD_AJENA');
    }

    await actualizarPasswordUsuarioUseCase({ usuarioId: id, passwordActual, passwordNueva });

    return res.status(200).json({
      status: 'success',
      code: 200,
      message: 'Contraseña actualizada correctamente.',
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { obtenerHistorialVuelos, obtenerUsuario, actualizarPassword };
