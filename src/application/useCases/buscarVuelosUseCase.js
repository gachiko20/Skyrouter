'use strict';

/**
 * Capa de Aplicación — caso de uso "Buscar vuelos disponibles" (HU-01).
 *
 * Orquesta: valida los criterios contra las reglas de dominio y delega la
 * consulta al repositorio inyectado. El repositorio se recibe por
 * parámetro (inyección de dependencias) para que este caso de uso sea
 * testeable sin PostgreSQL, sustituyendo `vuelosRepository` por un doble
 * de prueba.
 */

const { validarBusqueda } = require('../../domain/vuelos/reglasBusqueda');

/**
 * @param {{ vuelosRepository: { buscarVuelosDisponibles: Function } }} dependencias
 * @returns {(criterios: {origen: string, destino: string, fecha: string}) => Promise<object[]>}
 */
function crearBuscarVuelosUseCase({ vuelosRepository }) {
  return async function buscarVuelos({ origen, destino, fecha }) {
    const criterios = validarBusqueda({ origen, destino, fecha });
    return vuelosRepository.buscarVuelosDisponibles(criterios);
  };
}

module.exports = { crearBuscarVuelosUseCase };
