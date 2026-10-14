'use strict';

/**
 * Middleware de autenticación (SCRUM-49): exige un JWT válido en el header
 * `Authorization: Bearer <token>`, lo verifica contra `JWT_SECRET` y
 * adjunta su payload decodificado (`{ idUsuario, rol, iat, exp }`) a
 * `req.user`, para que cualquier ruta protegida lo consuma sin volver a
 * tocar `jsonwebtoken`.
 *
 * Cualquier fallo se delega al `errorHandler` centralizado vía
 * `next(error)` — igual que el resto de la app, nunca se formatea la
 * respuesta de error aquí.
 *
 * `process.env.JWT_SECRET` se lee dentro de la función (no se cachea en
 * una constante de módulo) a propósito: así no importa el orden de
 * `require` entre este archivo y quien cargue las variables de entorno
 * (`dotenv`); para cuando llega la primera request ya está disponible.
 */

const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../errors/AppError');

const MENSAJE_TOKEN_FALTANTE =
  'Se requiere autenticación: falta el header "Authorization: Bearer <token>".';
const MENSAJE_TOKEN_INVALIDO = 'El token de autenticación es inválido o expiró.';

function requireAuth(req, res, next) {
  const encabezado = req.headers.authorization || '';
  const [esquema, token] = encabezado.split(' ');

  if (esquema !== 'Bearer' || !token) {
    return next(new UnauthorizedError(MENSAJE_TOKEN_FALTANTE, 'TOKEN_FALTANTE'));
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (error) {
    return next(new UnauthorizedError(MENSAJE_TOKEN_INVALIDO, 'TOKEN_INVALIDO'));
  }
}

module.exports = requireAuth;
