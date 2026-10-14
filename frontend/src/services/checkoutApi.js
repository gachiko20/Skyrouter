import httpClient from './httpClient.js';

/**
 * POST /api/tiquetes/checkout.
 *
 * @param {{
 *   vueloId: string,
 *   asientoId: string,
 *   pasajeroId: string,
 *   datosPasajero: { nombreCompleto: string, correo: string, telefono: string, pasaporte: string },
 *   datosPago: { numeroTarjeta: string, fechaExpiracion: string, cvv: string, nombreTitular: string },
 * }} payload
 * @returns {Promise<object>} El tiquete confirmado (camelCase, incluye codigoReserva).
 * @throws {{message: string, code: string, status: number}} Normalizado por el interceptor.
 */
export async function confirmarCheckout(payload) {
  const { data } = await httpClient.post('/tiquetes/checkout', payload);
  return data.data.tiquete;
}

export default { confirmarCheckout };
