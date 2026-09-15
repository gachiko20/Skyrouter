'use strict';

/**
 * Capa de Presentación (Infrastructure/HTTP) — traduce HTTP <-> caso de uso.
 * No contiene lógica de negocio ni SQL; solo valida presencia de
 * parámetros de request y formatea la respuesta.
 */

const { crearBuscarVuelosUseCase } = require('../../application/useCases/buscarVuelosUseCase');
const vuelosRepository = require('../repositories/vuelosRepository');
const { ValidationError } = require('../../errors/AppError');

const buscarVuelos = crearBuscarVuelosUseCase({ vuelosRepository });

/**
 * GET /api/vuelos?origen=BOG&destino=MDE&fecha=2026-10-01
 *
 * 200 OK          -> { status, code, data: { vuelos: [...] } }
 * 400 Bad Request -> faltan parámetros o violan una regla de negocio (fecha pasada, origen = destino, formato IATA inválido)
 * 500             -> error inesperado de base de datos (manejado por errorHandler centralizado)
 */
async function listarVuelos(req, res, next) {
  try {
    const { origen, destino, fecha } = req.query;

    if (!origen || !destino || !fecha) {
      throw new ValidationError(
        'Los parámetros de búsqueda "origen", "destino" y "fecha" son obligatorios.',
        'DATOS_INCOMPLETOS'
      );
    }

    const vuelos = await buscarVuelos({ origen, destino, fecha });

    return res.status(200).json({
      status: 'success',
      code: 200,
      data: { vuelos },
    });
  } catch (error) {
    // Errores de negocio (ValidationError -> 400) y errores inesperados de
    // DB (-> 500) se resuelven en el middleware centralizado.
    return next(error);
  }
}

module.exports = { listarVuelos };
