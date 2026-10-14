'use strict';

/**
 * Capa de Aplicación — caso de uso "Buscar tiquetes (agente/administrador)"
 * (SCRUM-10): buscador básico por código de reserva o documento del
 * pasajero, para que el agente encuentre el tiquete que va a cancelar o
 * reagendar.
 *
 * Exige al menos uno de los dos criterios: sin esto, el endpoint se
 * convertiría en "listar todos los tiquetes del sistema", que no es lo que
 * pide un buscador.
 */

const { ValidationError } = require('../../errors/AppError');

const MENSAJE_CRITERIO_REQUERIDO =
  'Debes indicar "codigoReserva" o "documento" para buscar un tiquete.';

/**
 * @param {{ tiquetesAdminRepository: { buscarTiquetes: Function } }} dependencias
 * @returns {(criterios: { codigoReserva?: string, documento?: string }) => Promise<object[]>}
 */
function crearBuscarTiquetesAdminUseCase({ tiquetesAdminRepository }) {
  return async function buscarTiquetesAdmin({ codigoReserva, documento }) {
    if (!codigoReserva && !documento) {
      throw new ValidationError(MENSAJE_CRITERIO_REQUERIDO, 'CRITERIO_BUSQUEDA_REQUERIDO');
    }

    return tiquetesAdminRepository.buscarTiquetes({ codigoReserva, documento });
  };
}

module.exports = { crearBuscarTiquetesAdminUseCase };
