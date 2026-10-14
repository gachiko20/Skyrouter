'use strict';

/**
 * Capa de Aplicación — caso de uso "Obtener métricas administrativas"
 * (SCRUM-47): ingresos totales, conteo de tiquetes por estado, y ocupación
 * de los próximos vuelos.
 *
 * Sin parámetros de entrada ni ramas de error propias (es una agregación de
 * solo lectura): simplemente delega al repositorio inyectado. La inyección
 * de dependencias se mantiene por consistencia con el resto de casos de
 * uso, para que sea testeable sin PostgreSQL sustituyendo el repositorio
 * por un doble de prueba.
 *
 * @param {{ metricasAdminRepository: { obtenerMetricas: Function } }} dependencias
 * @returns {() => Promise<{
 *   ingresosTotales: number,
 *   tiquetesPorEstado: Record<string, number>,
 *   proximosVuelos: object[],
 * }>}
 */
function crearObtenerMetricasAdminUseCase({ metricasAdminRepository }) {
  return async function obtenerMetricasAdmin() {
    return metricasAdminRepository.obtenerMetricas();
  };
}

module.exports = { crearObtenerMetricasAdminUseCase };
