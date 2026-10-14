import httpClient from './httpClient.js';

const MENSAJE_ERROR_LOGIN = 'No fue posible iniciar sesión.';

/**
 * POST /api/auth/login.
 *
 * @param {{ correo: string, contrasena: string }} credenciales
 * @returns {Promise<{ token: string, usuario: { idUsuario: string, nombreCompleto: string, correo: string, rol: string } }>}
 * @throws {Error} Con el mensaje del backend (p. ej. 401 "Correo o contraseña incorrectos.") o uno genérico de red.
 */
export async function login({ correo, contrasena }) {
  try {
    const { data } = await httpClient.post('/auth/login', { correo, contrasena });
    return data.data;
  } catch (error) {
    const mensaje =
      error.response?.data?.message ||
      (error.request ? 'No fue posible conectar con el servidor.' : error.message) ||
      MENSAJE_ERROR_LOGIN;
    throw new Error(mensaje);
  }
}

export default { login };
