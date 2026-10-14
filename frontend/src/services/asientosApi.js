import httpClient from './httpClient.js';

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
    // `error` ya es el Error normalizado por el interceptor de
    // `httpClient.js` (`.status`, no `.response.status`: ese interceptor ya
    // consumió el error crudo de Axios antes de que llegue aquí).
    if (error.status === 409) {
      throw new AsientoNoDisponibleError(error.message || MENSAJE_ASIENTO_TOMADO);
    }

    throw error;
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
    error.message = error.message || MENSAJE_ERROR_LISTAR_ASIENTOS;
    throw error;
  }
}

export default { bloquearAsiento, listarAsientosPorVuelo };
