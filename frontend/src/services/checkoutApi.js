import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const httpClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
});

// Interceptor de respuesta: normaliza cualquier error (HTTP, red o
// timeout) a una forma única { message, code, status }, para que los
// componentes no tengan que conocer la forma de los errores de Axios
// (mismo patrón que `vuelosApi.js`).
httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const mensaje =
      error.response?.data?.message ||
      (error.request ? 'No fue posible conectar con el servidor.' : error.message);
    const codigo = error.response?.data?.errorCode || error.response?.status || 'ERROR_DESCONOCIDO';

    return Promise.reject({ message: mensaje, code: codigo, status: error.response?.status });
  }
);

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
