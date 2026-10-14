'use strict';

/**
 * Capa de Presentación (Infrastructure/HTTP) — traduce HTTP <-> caso de uso
 * para métricas administrativas (SCRUM-47). No contiene lógica de negocio
 * ni SQL; solo formatea la respuesta.
 */

const {
  crearObtenerMetricasAdminUseCase,
} = require('../../application/useCases/obtenerMetricasAdminUseCase');
const metricasAdminRepository = require('../repositories/metricasAdminRepository');

const obtenerMetricasAdminUseCase = crearObtenerMetricasAdminUseCase({ metricasAdminRepository });

/**
 * GET /api/admin/metricas
 * Protegida por `requireAuth` + `requireRole(['administrador', 'agente_comercial'])`
 * (ver `infrastructure/routes/adminRoutes.js`).
 *
 * 200 OK -> { status, code, data: {
 *   ingresosTotales: number,
 *   tiquetesPorEstado: { PENDIENTE, CONFIRMADO, CANCELADO, REAGENDADO },
 *   proximosVuelos: [{
 *     idVuelo, numeroVuelo, origen, destino, fechaHoraSalida,
 *     capacidadTotal, asientosOcupados, porcentajeOcupacion
 *   }]
 * } }
 */
async function obtenerMetricas(req, res, next) {
  try {
    const metricas = await obtenerMetricasAdminUseCase();

    return res.status(200).json({
      status: 'success',
      code: 200,
      data: metricas,
    });
  } catch (error) {
    // Cualquier error inesperado se delega al middleware centralizado,
    // nunca se formatea la respuesta de error aquí.
    return next(error);
  }
}

module.exports = { obtenerMetricas };
