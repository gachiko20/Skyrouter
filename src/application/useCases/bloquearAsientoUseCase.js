'use strict';

/**
 * Capa de Aplicación — caso de uso "Bloquear asiento temporalmente" (HU-02,
 * SCRUM-8).
 *
 * Orquesta: delega la operación transaccional al repositorio inyectado y
 * traduce su resultado a errores de negocio tipados. El repositorio se
 * recibe por parámetro (inyección de dependencias) para que este caso de
 * uso sea testeable sin PostgreSQL, sustituyendo `asientosRepository` por
 * un doble de prueba.
 */

const { ConflictError, NotFoundError } = require('../../errors/AppError');

const MENSAJE_ASIENTO_NO_ENCONTRADO =
  'El asiento indicado no existe o no pertenece al avión asignado a este vuelo.';
const MENSAJE_ASIENTO_NO_DISPONIBLE =
  'El asiento ya no está disponible: fue bloqueado o reservado por otro pasajero.';

/**
 * @param {{ asientosRepository: { bloquearAsientoTemporal: Function } }} dependencias
 * @returns {(datos: {vueloId: string, asientoId: string, usuarioId: string}) => Promise<object>}
 */
function crearBloquearAsientoUseCase({ asientosRepository }) {
  return async function bloquearAsiento({ vueloId, asientoId, usuarioId }) {
    const resultado = await asientosRepository.bloquearAsientoTemporal({ vueloId, asientoId, usuarioId });

    if (!resultado.ok) {
      if (resultado.motivo === 'ASIENTO_NO_ENCONTRADO') {
        throw new NotFoundError(MENSAJE_ASIENTO_NO_ENCONTRADO, 'ASIENTO_NO_ENCONTRADO');
      }

      // Si el repositorio indica que el asiento ya no está 'DISPONIBLE'
      // (bloqueado o reservado por otro usuario), es un conflicto de
      // negocio, no un error inesperado.
      throw new ConflictError(MENSAJE_ASIENTO_NO_DISPONIBLE, 'ASIENTO_NO_DISPONIBLE');
    }

    return resultado.tiquete;
  };
}

module.exports = { crearBloquearAsientoUseCase };
