'use strict';

/**
 * Capa de Aplicación — caso de uso "Consultar días con vuelos de una ruta"
 * (calendario del buscador).
 *
 * Orquesta: valida la ruta contra las reglas de dominio y delega la
 * consulta al repositorio inyectado (inyección de dependencias, igual que
 * `buscarVuelosUseCase`, para poder testearlo sin PostgreSQL).
 */

const { validarRuta } = require('../../domain/vuelos/reglasBusqueda');

/**
 * @param {{ vuelosRepository: { obtenerFechasConVuelos: Function } }} dependencias
 * @returns {(ruta: {origen: string, destino: string}) => Promise<string[]>} Fechas 'YYYY-MM-DD'.
 */
function crearObtenerDisponibilidadVuelosUseCase({ vuelosRepository }) {
  return async function obtenerDisponibilidadVuelos({ origen, destino }) {
    const ruta = validarRuta({ origen, destino });
    return vuelosRepository.obtenerFechasConVuelos(ruta);
  };
}

module.exports = { crearObtenerDisponibilidadVuelosUseCase };
