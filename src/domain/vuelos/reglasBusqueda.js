'use strict';

/**
 * Capa de Dominio — reglas de negocio puras para la búsqueda de vuelos
 * (HU-01 / SCRUM-7). Sin dependencias de Express ni de PostgreSQL: solo
 * validación de datos de entrada según reglas del negocio.
 */

const { ValidationError } = require('../../errors/AppError');

const FORMATO_CODIGO_IATA = /^[A-Za-z]{3}$/;

function normalizarCodigoIata(codigo) {
  return typeof codigo === 'string' ? codigo.trim().toUpperCase() : codigo;
}

/**
 * Valida y normaliza los criterios de búsqueda de vuelos.
 *
 * @param {{origen: string, destino: string, fecha: string}} criterios
 * @returns {{origen: string, destino: string, fecha: string}} Criterios normalizados.
 * @throws {ValidationError}
 */
function validarBusqueda({ origen, destino, fecha }) {
  const origenNormalizado = normalizarCodigoIata(origen);
  const destinoNormalizado = normalizarCodigoIata(destino);

  if (!FORMATO_CODIGO_IATA.test(origenNormalizado || '') || !FORMATO_CODIGO_IATA.test(destinoNormalizado || '')) {
    throw new ValidationError(
      'Origen y destino deben ser códigos IATA de 3 letras (ej. BOG).',
      'FORMATO_IATA_INVALIDO'
    );
  }

  if (origenNormalizado === destinoNormalizado) {
    throw new ValidationError('El origen y el destino no pueden ser el mismo.', 'ORIGEN_DESTINO_IGUALES');
  }

  const fechaBusqueda = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(fechaBusqueda.getTime())) {
    throw new ValidationError(
      'La fecha proporcionada no es válida (formato esperado: YYYY-MM-DD).',
      'FECHA_INVALIDA'
    );
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  if (fechaBusqueda < hoy) {
    throw new ValidationError('No se pueden buscar vuelos con fecha en el pasado.', 'FECHA_EN_EL_PASADO');
  }

  return { origen: origenNormalizado, destino: destinoNormalizado, fecha };
}

module.exports = { validarBusqueda };
