import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Misma clave que escribe/borra `AuthContext.jsx` en cada login/logout.
// Este archivo la lee directo de localStorage (no del contexto de React)
// porque es un módulo plano sin acceso a hooks; ambos quedan sincronizados
// porque login/logout son los ÚNICOS puntos que tocan esta clave.
const CLAVE_TOKEN = 'skyrouter_token';

/**
 * Instancia central de Axios (SCRUM-49): todos los servicios (`vuelosApi`,
 * `asientosApi`, `checkoutApi`, `historialApi`, `usuariosApi`, `authApi`)
 * importan y usan ESTA instancia en vez de crear la suya con `axios.create`,
 * para que la base URL y el interceptor de autenticación vivan en un solo
 * lugar.
 */
const httpClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
});

// Inyecta el JWT (si hay sesión activa) en toda petición saliente.
httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(CLAVE_TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normaliza cualquier error (HTTP, red o timeout) a un Error real con
// `.code`/`.status` adjuntos, para que los componentes no tengan que
// conocer la forma de los errores de Axios. Antes esta misma lógica vivía
// duplicada, idéntica, en vuelosApi.js y checkoutApi.js (rechazando con un
// objeto plano en vez de un Error); con la instancia centralizada se
// registra una sola vez, y se usa `Error` real para que `instanceof
// Error`/estar en el stack de consola sigan funcionando como siempre
// deberían.
httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Con `responseType: 'blob'` (p. ej. descarga de facturas) el cuerpo
    // JSON de error del backend también llega como Blob: se parsea aquí
    // para que el mensaje/errorCode sigan disponibles abajo.
    if (error.response?.data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await error.response.data.text());
      } catch {
        error.response.data = {};
      }
    }

    const mensaje =
      error.response?.data?.message ||
      (error.request ? 'No fue posible conectar con el servidor.' : error.message);
    const codigo = error.response?.data?.errorCode || error.response?.status || 'ERROR_DESCONOCIDO';

    const errorNormalizado = new Error(mensaje);
    errorNormalizado.code = codigo;
    errorNormalizado.status = error.response?.status;
    return Promise.reject(errorNormalizado);
  }
);

export default httpClient;
export { CLAVE_TOKEN };
