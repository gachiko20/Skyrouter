import httpClient from './httpClient.js';

const MENSAJE_ERROR_HISTORIAL = 'No fue posible cargar el historial de vuelos.';

/**
 * GET /api/usuarios/:id/historial.
 *
 * @param {string} usuarioId
 * @returns {Promise<object[]>} Historial de tiquetes del usuario (camelCase:
 *   idTiquete, codigoReserva, numeroVuelo, origen, destino, ruta,
 *   fechaHoraSalida, fechaHoraLlegada, asiento: { codigoAsiento, clase },
 *   estado, precioPagado, fechaReserva).
 * @throws {Error} Con el mensaje del backend (p. ej. 404 "El usuario indicado no existe.") o uno genérico de red.
 */
export async function obtenerHistorialVuelos(usuarioId) {
  try {
    const { data } = await httpClient.get(`/usuarios/${usuarioId}/historial`);
    return data.data.historial;
  } catch (error) {
    // `error` ya es el Error normalizado por el interceptor de `httpClient.js`.
    error.message = error.message || MENSAJE_ERROR_HISTORIAL;
    throw error;
  }
}

export default { obtenerHistorialVuelos };
