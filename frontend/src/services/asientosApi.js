import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const httpClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
});

/**
 * Error de negocio específico para un 409 Conflict: el asiento ya fue
 * bloqueado/reservado por otro pasajero un instante antes. Se distingue del
 * resto de errores (red, validación, 5xx) para que la UI pueda reaccionar
 * de forma distinta (actualizar ese asiento a OCUPADO en vez de mostrar un
 * error genérico).
 */
export class AsientoNoDisponibleError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AsientoNoDisponibleError';
  }
}

const MENSAJE_ASIENTO_TOMADO = 'El asiento ya fue tomado, por favor selecciona otro.';

/**
 * POST /api/asientos/bloquear (HU-02, SCRUM-8).
 *
 * @param {{vueloId: string, asientoId: string, usuarioId: string}} datos
 * @returns {Promise<object>} El tiquete (bloqueo temporal, estado PENDIENTE) creado.
 * @throws {AsientoNoDisponibleError} Si el backend responde 409 Conflict.
 */
export async function bloquearAsiento({ vueloId, asientoId, usuarioId }) {
  try {
    const { data } = await httpClient.post('/asientos/bloquear', { vueloId, asientoId, usuarioId });
    return data.data.tiquete;
  } catch (error) {
    if (error.response?.status === 409) {
      throw new AsientoNoDisponibleError(error.response.data?.message || MENSAJE_ASIENTO_TOMADO);
    }

    const mensaje =
      error.response?.data?.message ||
      (error.request ? 'No fue posible conectar con el servidor.' : error.message);
    throw new Error(mensaje);
  }
}

const MENSAJE_ERROR_LISTAR_ASIENTOS = 'No fue posible cargar el mapa de asientos de este vuelo.';

/**
 * GET /api/vuelos/:vueloId/asientos.
 *
 * @param {string} vueloId
 * @returns {Promise<object[]>} Asientos del vuelo (camelCase: idAsiento, codigoAsiento, fila, columna, clase, estado).
 * @throws {Error} Con el mensaje del backend (p. ej. 404 "El vuelo indicado no existe.") o uno genérico de red.
 */
export async function listarAsientosPorVuelo(vueloId) {
  try {
    const { data } = await httpClient.get(`/vuelos/${vueloId}/asientos`);
    return data.data.asientos;
  } catch (error) {
    const mensaje =
      error.response?.data?.message ||
      (error.request ? 'No fue posible conectar con el servidor.' : error.message) ||
      MENSAJE_ERROR_LISTAR_ASIENTOS;
    throw new Error(mensaje);
  }
}

export default { bloquearAsiento, listarAsientosPorVuelo };
