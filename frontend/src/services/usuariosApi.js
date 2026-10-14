import httpClient from './httpClient.js';

const MENSAJE_ERROR_PERFIL = 'No fue posible cargar los datos del perfil.';
const MENSAJE_ERROR_PASSWORD = 'No fue posible actualizar la contraseña.';

// `error` ya es el Error normalizado por el interceptor de `httpClient.js`.
function normalizarError(error, mensajePorDefecto) {
  error.message = error.message || mensajePorDefecto;
  return error;
}

/**
 * GET /api/usuarios/:id.
 *
 * @param {string} usuarioId
 * @returns {Promise<object>} Perfil del usuario (camelCase: idUsuario, nombreCompleto, correo, telefono, rol).
 * @throws {Error} Con el mensaje del backend (p. ej. 404 "El usuario indicado no existe.") o uno genérico de red.
 */
export async function obtenerUsuario(usuarioId) {
  try {
    const { data } = await httpClient.get(`/usuarios/${usuarioId}`);
    return data.data.usuario;
  } catch (error) {
    throw normalizarError(error, MENSAJE_ERROR_PERFIL);
  }
}

/**
 * PATCH /api/usuarios/:id/password.
 *
 * @param {string} usuarioId
 * @param {{ passwordActual: string, passwordNueva: string }} datos
 * @returns {Promise<string>} Mensaje de confirmación devuelto por el backend.
 * @throws {Error} Con el mensaje del backend (p. ej. 401 "La contraseña actual es incorrecta.") o uno genérico de red.
 */
export async function actualizarPassword(usuarioId, { passwordActual, passwordNueva }) {
  try {
    const { data } = await httpClient.patch(`/usuarios/${usuarioId}/password`, {
      passwordActual,
      passwordNueva,
    });
    return data.message;
  } catch (error) {
    throw normalizarError(error, MENSAJE_ERROR_PASSWORD);
  }
}

export default { obtenerUsuario, actualizarPassword };
