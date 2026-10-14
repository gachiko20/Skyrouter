'use strict';

/**
 * Capa de Aplicación — caso de uso "Consultar perfil de un usuario".
 *
 * Mismo patrón que `obtenerHistorialVuelosUseCase`: delega la consulta al
 * repositorio inyectado y traduce su resultado a errores de negocio
 * tipados, sin SQL ni detalles de HTTP en este archivo.
 */

const { NotFoundError } = require('../../errors/AppError');

const MENSAJE_USUARIO_NO_ENCONTRADO = 'El usuario indicado no existe.';

/**
 * @param {{ usuariosRepository: { obtenerUsuarioPorId: Function } }} dependencias
 * @returns {(usuarioId: string) => Promise<object>}
 */
function crearObtenerPerfilUsuarioUseCase({ usuariosRepository }) {
  return async function obtenerPerfilUsuario(usuarioId) {
    const resultado = await usuariosRepository.obtenerUsuarioPorId(usuarioId);

    if (!resultado.ok) {
      throw new NotFoundError(MENSAJE_USUARIO_NO_ENCONTRADO, 'USUARIO_NO_ENCONTRADO');
    }

    return resultado.usuario;
  };
}

module.exports = { crearObtenerPerfilUsuarioUseCase };
