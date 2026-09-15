'use strict';

/**
 * Middleware centralizado de manejo de errores (debe registrarse último,
 * después de todas las rutas, con 4 parámetros para que Express lo
 * reconozca como error handler).
 *
 * Mapea a 409 Conflict:
 *   - Errores de negocio `ConflictError` con code 'ASIENTO_NO_DISPONIBLE'.
 *   - Códigos SQLSTATE de PostgreSQL asociados a conflictos de concurrencia:
 *       40P01  deadlock_detected
 *       55P03  lock_not_available
 *       23505  unique_violation (red de seguridad del índice único parcial
 *              anti-overbooking, en caso de que escape sin pasar por el
 *              servicio como ConflictError)
 */

const { AppError } = require('../errors/AppError');

const PG_DEADLOCK_DETECTED = '40P01';
const PG_LOCK_NOT_AVAILABLE = '55P03';
const PG_UNIQUE_VIOLATION = '23505';

const PG_CODIGOS_CONFLICTO_CONCURRENCIA = new Set([
  PG_DEADLOCK_DETECTED,
  PG_LOCK_NOT_AVAILABLE,
  PG_UNIQUE_VIOLATION,
]);

const MENSAJE_ASIENTO_NO_DISPONIBLE =
  'El asiento ya ha sido seleccionado o reservado por otro usuario.';

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // 1) Errores de negocio ya tipados (incluye ConflictError/ASIENTO_NO_DISPONIBLE).
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      code: err.statusCode,
      message: err.message,
      errorCode: err.code,
    });
  }

  // 2) Errores crudos de PostgreSQL relacionados con concurrencia que no
  // hayan sido traducidos explícitamente por la capa de servicio.
  if (err.code && PG_CODIGOS_CONFLICTO_CONCURRENCIA.has(err.code)) {
    console.warn(
      `[concurrencia] Conflicto detectado por PostgreSQL (sqlstate ${err.code}): ${err.message}`
    );
    return res.status(409).json({
      status: 'error',
      code: 409,
      message: MENSAJE_ASIENTO_NO_DISPONIBLE,
    });
  }

  // 3) Cualquier otro error: no se filtran detalles internos al cliente.
  console.error('[errorHandler] Error no controlado:', err);
  return res.status(500).json({
    status: 'error',
    code: 500,
    message: 'Ha ocurrido un error interno en el servidor.',
  });
}

module.exports = errorHandler;
