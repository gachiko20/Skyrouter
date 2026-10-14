import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { login as loginApi } from '../services/authApi.js';
import { CLAVE_TOKEN } from '../services/httpClient.js';

const AuthContext = createContext(null);

const CLAVE_USUARIO = 'skyrouter_usuario';

/**
 * Lee la sesión persistida en localStorage para inicializar el estado en el
 * primer render (sobrevive recargas de página). Cualquier fallo al leer o
 * parsear (localStorage bloqueado, JSON corrupto) se trata como "no hay
 * sesión" en vez de romper el arranque de la app.
 */
function leerSesionGuardada() {
  try {
    const token = localStorage.getItem(CLAVE_TOKEN);
    const usuarioJson = localStorage.getItem(CLAVE_USUARIO);
    if (!token || !usuarioJson) return { token: null, usuario: null };
    return { token, usuario: JSON.parse(usuarioJson) };
  } catch {
    return { token: null, usuario: null };
  }
}

function guardarSesion(token, usuario) {
  try {
    localStorage.setItem(CLAVE_TOKEN, token);
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
  } catch {
    // localStorage puede no estar disponible (modo privado, cuotas, etc.);
    // la sesión sigue funcionando en memoria para esta pestaña, solo no
    // persiste entre recargas.
  }
}

function borrarSesion() {
  try {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
  } catch {
    // ver nota en guardarSesion
  }
}

/**
 * Estado global de sesión (SCRUM-49): token JWT + datos del usuario
 * autenticado, persistidos en localStorage.
 *
 * El interceptor de Axios (`services/httpClient.js`) lee el token directo
 * de localStorage, no de este contexto, porque es un módulo plano sin
 * acceso a React. Ambos quedan sincronizados porque `login`/`logout` son
 * los ÚNICOS puntos de toda la app que escriben esa clave, y siempre lo
 * hacen en los dos lados (estado de React + localStorage) a la vez.
 */
function AuthProvider({ children }) {
  const [{ token, usuario }, setSesion] = useState(leerSesionGuardada);

  const login = useCallback(async (correo, contrasena) => {
    const resultado = await loginApi({ correo, contrasena });
    guardarSesion(resultado.token, resultado.usuario);
    setSesion({ token: resultado.token, usuario: resultado.usuario });
    return resultado.usuario;
  }, []);

  const logout = useCallback(() => {
    borrarSesion();
    setSesion({ token: null, usuario: null });
  }, []);

  const value = useMemo(
    () => ({
      token,
      usuario,
      estaAutenticado: Boolean(token && usuario),
      login,
      logout,
    }),
    [token, usuario, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** @returns {{token: string|null, usuario: object|null, estaAutenticado: boolean, login: Function, logout: Function}} */
function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de un <AuthProvider>.');
  }
  return contexto;
}

export { AuthProvider, useAuth };
