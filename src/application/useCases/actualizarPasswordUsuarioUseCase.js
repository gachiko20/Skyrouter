'use strict';

/**
 * Capa de Aplicación — caso de uso "Cambiar contraseña de un usuario".
 *
 * Orquesta: valida los datos de entrada, verifica la contraseña actual
 * contra el hash persistido (bcrypt) y, si coincide, calcula el nuevo hash
 * y delega su persistencia al repositorio inyectado. Ni el repositorio ni
 * este caso de uso exponen el hash fuera de este flujo.
 *
 * `bcrypt` se recibe por parámetro (inyección de dependencias), igual que
 * `usuariosRepository`, para que este caso de uso sea testeable sin
 * PostgreSQL ni cómputo real de hashing.
 */

const { NotFoundError, UnauthorizedError, ValidationError } = require('../../errors/AppError');

const SALT_ROUNDS = 10;
const LONGITUD_MINIMA_PASSWORD = 8;
const PATRON_PASSWORD_VALIDA = /(?=.*[A-Za-z])(?=.*\d).{8,}/;

const MENSAJE_DATOS_INCOMPLETOS = 'La contraseña actual y la nueva contraseña son obligatorias.';
const MENSAJE_PASSWORD_INVALIDA =
  'La nueva contraseña debe tener mínimo 8 caracteres, incluyendo letras y números.';
const MENSAJE_USUARIO_NO_ENCONTRADO = 'El usuario indicado no existe.';
const MENSAJE_PASSWORD_ACTUAL_INCORRECTA = 'La contraseña actual es incorrecta.';

function validarDatos({ passwordActual, passwordNueva }) {
  if (!passwordActual || !passwordNueva) {
    throw new ValidationError(MENSAJE_DATOS_INCOMPLETOS, 'DATOS_INCOMPLETOS');
  }

  if (passwordNueva.length < LONGITUD_MINIMA_PASSWORD || !PATRON_PASSWORD_VALIDA.test(passwordNueva)) {
    throw new ValidationError(MENSAJE_PASSWORD_INVALIDA, 'PASSWORD_INVALIDA');
  }
}

/**
 * @param {{
 *   usuariosRepository: { obtenerHashContrasenaPorId: Function, actualizarHashContrasena: Function },
 *   bcrypt: { compare: Function, hash: Function },
 * }} dependencias
 * @returns {(datos: { usuarioId: string, passwordActual: string, passwordNueva: string }) => Promise<void>}
 */
function crearActualizarPasswordUsuarioUseCase({ usuariosRepository, bcrypt }) {
  return async function actualizarPasswordUsuario({ usuarioId, passwordActual, passwordNueva }) {
    validarDatos({ passwordActual, passwordNueva });

    const resultado = await usuariosRepository.obtenerHashContrasenaPorId(usuarioId);

    if (!resultado.ok) {
      throw new NotFoundError(MENSAJE_USUARIO_NO_ENCONTRADO, 'USUARIO_NO_ENCONTRADO');
    }

    const coincide = await bcrypt.compare(passwordActual, resultado.hashContrasena);

    if (!coincide) {
      throw new UnauthorizedError(MENSAJE_PASSWORD_ACTUAL_INCORRECTA, 'PASSWORD_ACTUAL_INCORRECTA');
    }

    const nuevoHash = await bcrypt.hash(passwordNueva, SALT_ROUNDS);
    await usuariosRepository.actualizarHashContrasena(usuarioId, nuevoHash);
  };
}

module.exports = { crearActualizarPasswordUsuarioUseCase };
