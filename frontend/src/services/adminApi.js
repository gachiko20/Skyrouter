import httpClient from './httpClient.js';

const MENSAJE_ERROR_METRICAS = 'No fue posible cargar las métricas administrativas.';
const MENSAJE_ERROR_BUSQUEDA = 'No fue posible buscar tiquetes.';
const MENSAJE_ERROR_ACTUALIZAR_ESTADO = 'No fue posible actualizar el tiquete.';

/**
 * GET /api/admin/metricas (SCRUM-47). Protegido en el backend por
 * requireAuth + requireRole(['administrador', 'agente_comercial']); el
 * token ya viaja automáticamente en cada request vía el interceptor de
 * `httpClient.js`, así que este servicio no necesita saber nada de auth.
 *
 * @returns {Promise<{
 *   ingresosTotales: number,
 *   tiquetesPorEstado: Record<'PENDIENTE'|'CONFIRMADO'|'CANCELADO'|'REAGENDADO', number>,
 *   proximosVuelos: Array<{
 *     idVuelo: string, numeroVuelo: string, origen: string, destino: string,
 *     fechaHoraSalida: string, capacidadTotal: number, asientosOcupados: number,
 *     porcentajeOcupacion: number,
 *   }>,
 * }>}
 * @throws {Error} Con el mensaje del backend o uno genérico de red (normalizado por el interceptor).
 */
export async function obtenerMetricas() {
  try {
    const { data } = await httpClient.get('/admin/metricas');
    return data.data;
  } catch (error) {
    error.message = error.message || MENSAJE_ERROR_METRICAS;
    throw error;
  }
}

/**
 * GET /api/admin/tiquetes?codigoReserva=...|?documento=... (SCRUM-10).
 * Buscador básico: el backend exige al menos uno de los dos criterios.
 *
 * @param {{ codigoReserva?: string, documento?: string }} criterios
 * @returns {Promise<object[]>} Tiquetes encontrados (camelCase: idTiquete,
 *   codigoReserva, estado, precioPagado, numeroVuelo, origen, destino,
 *   fechaHoraSalida, codigoAsiento, nombrePasajero, documentoPasajero, correoPasajero).
 * @throws {Error} Con el mensaje del backend (p. ej. 400 si no se indica ningún criterio) o uno genérico de red.
 */
export async function buscarTiquetes({ codigoReserva, documento }) {
  try {
    const { data } = await httpClient.get('/admin/tiquetes', { params: { codigoReserva, documento } });
    return data.data.tiquetes;
  } catch (error) {
    error.message = error.message || MENSAJE_ERROR_BUSQUEDA;
    throw error;
  }
}

/**
 * PATCH /api/admin/tiquetes/:id/estado (SCRUM-10).
 *
 * @param {string} idTiquete
 * @param {{ estado: 'CANCELADO' } | { estado: 'REAGENDADO', nuevoVueloId: string, nuevoAsientoId: string }} payload
 * @returns {Promise<object>} El tiquete actualizado.
 * @throws {Error} Con el mensaje del backend (p. ej. 409 "El tiquete ya está cancelado.") o uno genérico de red.
 */
export async function actualizarEstadoTiquete(idTiquete, payload) {
  try {
    const { data } = await httpClient.patch(`/admin/tiquetes/${idTiquete}/estado`, payload);
    return data.data.tiquete;
  } catch (error) {
    error.message = error.message || MENSAJE_ERROR_ACTUALIZAR_ESTADO;
    throw error;
  }
}

/**
 * POST /api/admin/ventas — venta en mostrador (pago en efectivo/POS).
 *
 * @param {{
 *   vueloId: string,
 *   asientoId: string,
 *   pasajero: { documento: string, nombres: string, apellidos: string, correo: string, telefono?: string },
 * }} payload
 * @returns {Promise<{ tiquete: object, pasajeroCreado: boolean }>}
 * @throws {Error} Con `.code` del backend (p. ej. 'ASIENTO_NO_DISPONIBLE', 'CORREO_DE_OTRO_PASAJERO').
 */
export async function registrarVentaAdmin(payload) {
  const { data } = await httpClient.post('/admin/ventas', payload);
  return data.data;
}

export default { obtenerMetricas, buscarTiquetes, actualizarEstadoTiquete, registrarVentaAdmin };
