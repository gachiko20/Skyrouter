import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const httpClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
});

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
    const mensaje =
      error.response?.data?.message ||
      (error.request ? 'No fue posible conectar con el servidor.' : error.message) ||
      MENSAJE_ERROR_HISTORIAL;
    throw new Error(mensaje);
  }
}

export default { obtenerHistorialVuelos };
