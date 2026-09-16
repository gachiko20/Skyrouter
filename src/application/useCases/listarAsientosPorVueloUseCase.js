'use strict';

/**
 * Capa de Aplicación — caso de uso "Listar asientos de un vuelo".
 *
 * Orquesta: delega la consulta al repositorio inyectado y traduce su
 * resultado a errores de negocio tipados. El repositorio se recibe por
 * parámetro (inyección de dependencias) para que este caso de uso sea
 * testeable sin PostgreSQL.
 */

const { NotFoundError } = require('../../errors/AppError');

const MENSAJE_VUELO_NO_ENCONTRADO = 'El vuelo indicado no existe.';

/**
 * @param {{ asientosRepository: { listarPorVuelo: Function } }} dependencias
 * @returns {(vueloId: string) => Promise<object[]>}
 */
function crearListarAsientosPorVueloUseCase({ asientosRepository }) {
  return async function listarAsientosPorVuelo(vueloId) {
    const resultado = await asientosRepository.listarPorVuelo(vueloId);

    if (!resultado.ok) {
      throw new NotFoundError(MENSAJE_VUELO_NO_ENCONTRADO, 'VUELO_NO_ENCONTRADO');
    }

    return resultado.asientos;
  };
}

module.exports = { crearListarAsientosPorVueloUseCase };
