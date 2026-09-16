'use strict';

/**
 * Capa de Aplicación — caso de uso "Consultar historial de vuelos de un
 * usuario".
 *
 * Orquesta: valida (vía el resultado del repositorio) que el usuario
 * exista y delega la consulta al repositorio inyectado, traduciendo su
 * resultado a errores de negocio tipados. El repositorio se recibe por
 * parámetro (inyección de dependencias) para que este caso de uso sea
 * testeable sin PostgreSQL.
 */

const { NotFoundError } = require('../../errors/AppError');

const MENSAJE_USUARIO_NO_ENCONTRADO = 'El usuario indicado no existe.';

/**
 * @param {{ usuariosRepository: { obtenerHistorialVuelos: Function } }} dependencias
 * @returns {(usuarioId: string) => Promise<object[]>}
 */
function crearObtenerHistorialVuelosUseCase({ usuariosRepository }) {
  return async function obtenerHistorialVuelos(usuarioId) {
    const resultado = await usuariosRepository.obtenerHistorialVuelos(usuarioId);

    if (!resultado.ok) {
      throw new NotFoundError(MENSAJE_USUARIO_NO_ENCONTRADO, 'USUARIO_NO_ENCONTRADO');
    }

    return resultado.historial;
  };
}

module.exports = { crearObtenerHistorialVuelosUseCase };
