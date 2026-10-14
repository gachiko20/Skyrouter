'use strict';

/**
 * Capa de Aplicación — caso de uso "Gestionar tiquete (agente/administrador)"
 * (SCRUM-10): cancelar o reagendar un tiquete existente.
 *
 * Orquesta: valida la forma de la entrada (qué acción se pidió y si trae
 * los datos que esa acción necesita) y delega la operación transaccional al
 * repositorio inyectado, traduciendo su resultado a errores de negocio
 * tipados. El repositorio se recibe por parámetro (inyección de
 * dependencias) para que este caso de uso sea testeable sin PostgreSQL.
 */

const { ConflictError, NotFoundError, ValidationError } = require('../../errors/AppError');

const ESTADOS_SOPORTADOS = ['CANCELADO', 'REAGENDADO'];

const MENSAJE_ESTADO_INVALIDO = `El campo "estado" debe ser uno de: ${ESTADOS_SOPORTADOS.join(', ')}.`;
const MENSAJE_REAGENDAMIENTO_INCOMPLETO =
  'Reagendar requiere "nuevoVueloId" y "nuevoAsientoId" en el body.';
const MENSAJE_TIQUETE_NO_ENCONTRADO = 'El tiquete indicado no existe.';
const MENSAJE_TIQUETE_YA_CANCELADO = 'El tiquete ya está cancelado.';
const MENSAJE_ASIENTO_NO_ENCONTRADO =
  'El nuevo asiento no existe o no pertenece al avión asignado a ese vuelo.';
const MENSAJE_ASIENTO_NO_DISPONIBLE = 'El nuevo asiento ya está ocupado o reservado por otro pasajero.';

/** Traduce `{ ok: false, motivo }` del repositorio a un error de negocio tipado. */
function lanzarErrorDeMotivo(motivo) {
  switch (motivo) {
    case 'TIQUETE_NO_ENCONTRADO':
      throw new NotFoundError(MENSAJE_TIQUETE_NO_ENCONTRADO, 'TIQUETE_NO_ENCONTRADO');
    case 'TIQUETE_YA_CANCELADO':
      throw new ConflictError(MENSAJE_TIQUETE_YA_CANCELADO, 'TIQUETE_YA_CANCELADO');
    case 'ASIENTO_NO_ENCONTRADO':
      throw new NotFoundError(MENSAJE_ASIENTO_NO_ENCONTRADO, 'ASIENTO_NO_ENCONTRADO');
    default: // 'ASIENTO_NO_DISPONIBLE'
      throw new ConflictError(MENSAJE_ASIENTO_NO_DISPONIBLE, 'ASIENTO_NO_DISPONIBLE');
  }
}

/**
 * @param {{
 *   tiquetesAdminRepository: { cancelarTiquete: Function, reagendarTiquete: Function },
 * }} dependencias
 * @returns {(datos: {
 *   idTiquete: string,
 *   estado: 'CANCELADO' | 'REAGENDADO',
 *   nuevoVueloId?: string,
 *   nuevoAsientoId?: string,
 *   idAgente: string,
 * }) => Promise<{ tiquete: object, vuelosAfectados: string[] }>}
 */
function crearGestionarTiqueteAdminUseCase({ tiquetesAdminRepository }) {
  return async function gestionarTiqueteAdmin({
    idTiquete,
    estado,
    nuevoVueloId,
    nuevoAsientoId,
    idAgente,
  }) {
    if (!ESTADOS_SOPORTADOS.includes(estado)) {
      throw new ValidationError(MENSAJE_ESTADO_INVALIDO, 'ESTADO_INVALIDO');
    }

    if (estado === 'CANCELADO') {
      const resultado = await tiquetesAdminRepository.cancelarTiquete({ idTiquete, idAgente });

      if (!resultado.ok) {
        lanzarErrorDeMotivo(resultado.motivo);
      }

      return { tiquete: resultado.tiquete, vuelosAfectados: [resultado.idVueloAfectado] };
    }

    // estado === 'REAGENDADO'
    if (!nuevoVueloId || !nuevoAsientoId) {
      throw new ValidationError(MENSAJE_REAGENDAMIENTO_INCOMPLETO, 'DATOS_REAGENDAMIENTO_INCOMPLETOS');
    }

    const resultado = await tiquetesAdminRepository.reagendarTiquete({
      idTiquete,
      nuevoVueloId,
      nuevoAsientoId,
      idAgente,
    });

    if (!resultado.ok) {
      lanzarErrorDeMotivo(resultado.motivo);
    }

    // Dedupe: si se "reagenda" al mismo vuelo (solo cambia de asiento), no
    // se debe emitir dos veces el evento a la misma sala.
    const vuelosAfectados = [...new Set([resultado.idVueloAnterior, resultado.idVueloNuevo])];

    return { tiquete: resultado.tiquete, vuelosAfectados };
  };
}

module.exports = { crearGestionarTiqueteAdminUseCase };
