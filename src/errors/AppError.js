'use strict';

/**
 * Errores de negocio tipados. `errorHandler.js` los distingue de errores
 * inesperados (bugs, fallos de infraestructura) mediante `instanceof
 * AppError` y usa `statusCode`/`code` para construir la respuesta HTTP.
 */
class AppError extends Error {
  /**
   * @param {string} message  Mensaje legible, apto para mostrar al cliente.
   * @param {number} statusCode  Código HTTP a responder.
   * @param {string} code  Código de error de aplicación, estable para que
   *   el frontend/otros servicios puedan hacer `switch` sobre él sin
   *   parsear el mensaje (p. ej. 'ASIENTO_NO_DISPONIBLE').
   */
  constructor(message, statusCode, code) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

class ConflictError extends AppError {
  constructor(message, code = 'CONFLICT') {
    super(message, 409, code);
  }
}

class UnauthorizedError extends AppError {
  constructor(message, code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

class ForbiddenError extends AppError {
  constructor(message, code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

class NotFoundError extends AppError {
  constructor(message, code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

class ValidationError extends AppError {
  constructor(message, code = 'VALIDATION_ERROR') {
    super(message, 400, code);
  }
}

module.exports = {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
};
