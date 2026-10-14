import httpClient from './httpClient.js';

/**
 * @param {{origen: string, destino: string, fecha: string}} criterios
 * @returns {Promise<object[]>} Lista de vuelos disponibles (camelCase).
 */
export async function buscarVuelos({ origen, destino, fecha }) {
  const { data } = await httpClient.get('/vuelos', { params: { origen, destino, fecha } });
  return data.data.vuelos;
}

/**
 * GET /api/vuelos/disponibilidad — días con al menos un vuelo futuro para la ruta.
 *
 * @param {{origen: string, destino: string}} ruta
 * @returns {Promise<string[]>} Fechas 'YYYY-MM-DD' en orden ascendente.
 */
export async function obtenerDisponibilidadVuelos({ origen, destino }) {
  const { data } = await httpClient.get('/vuelos/disponibilidad', { params: { origen, destino } });
  return data.data.fechas;
}

export default httpClient;
