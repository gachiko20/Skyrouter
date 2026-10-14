'use strict';

/**
 * Fábrica de middleware de autorización (SCRUM-49): recibe los roles
 * permitidos para una ruta y devuelve el middleware de Express que la
 * protege, p. ej. `requireRole(['administrador'])` o
 * `requireRole(['agente_comercial', 'administrador'])`.
 *
 * Debe montarse SIEMPRE después de `requireAuth` en la cadena de la ruta:
 * depende de `req.user.rol`, que solo existe si `requireAuth` ya corrió y
 * verificó el JWT. Si `req.user` no existe (middleware mal ordenado, o
 * ruta sin `requireAuth`), se trata igual que un rol no autorizado en vez
 * de lanzar un error de programación: 403, nunca un 500.
 */

const { ForbiddenError } = require('../errors/AppError');

const MENSAJE_ROL_NO_AUTORIZADO = 'No tienes permisos para acceder a este recurso.';

function requireRole(rolesPermitidos) {
  return function verificarRol(req, res, next) {
    if (!req.user || !rolesPermitidos.includes(req.user.rol)) {
      return next(new ForbiddenError(MENSAJE_ROL_NO_AUTORIZADO, 'ROL_NO_AUTORIZADO'));
    }
    return next();
  };
}

module.exports = requireRole;
