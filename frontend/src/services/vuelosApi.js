import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const httpClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
});

// Interceptor de respuesta: normaliza cualquier error (HTTP, red o
// timeout) a una forma única { message, code, status }, para que los
// componentes no tengan que conocer la forma de los errores de Axios.
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
 * @param {{origen: string, destino: string, fecha: string}} criterios
 * @returns {Promise<object[]>} Lista de vuelos disponibles (camelCase).
 */
export async function buscarVuelos({ origen, destino, fecha }) {
  const { data } = await httpClient.get('/vuelos', { params: { origen, destino, fecha } });
  return data.data.vuelos;
}

export default httpClient;
