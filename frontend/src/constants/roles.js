export const ROL_PASAJERO = 'pasajero';
export const ROL_AGENTE_COMERCIAL = 'agente_comercial';
export const ROL_ADMINISTRADOR = 'administrador';

/**
 * Roles con acceso a la zona administrativa (`/admin/*`). Única fuente de
 * verdad para esta lista: antes vivía duplicada en `App.jsx`
 * (`<ProtectedRoute allowedRoles={[...]} />`) y ahora también la necesitan
 * `LoginPage.jsx` (a dónde redirigir tras iniciar sesión) y
 * `DashboardLayout.jsx` (sacar a un agente/administrador del panel de
 * pasajero) — tenerla en tres sitios es tener tres formas de que se
 * desincronicen.
 */
export const ROLES_ADMINISTRATIVOS = [ROL_AGENTE_COMERCIAL, ROL_ADMINISTRADOR];

const RUTA_INICIO_ADMINISTRATIVO = '/admin/tiquetes';
const RUTA_INICIO_PASAJERO = '/';

/** Ruta de aterrizaje por defecto según el rol, usada tras el login y por las guardas de layout. */
export function obtenerRutaInicioPorRol(rol) {
  return ROLES_ADMINISTRATIVOS.includes(rol) ? RUTA_INICIO_ADMINISTRATIVO : RUTA_INICIO_PASAJERO;
}

/**
 * Calcula a dónde navegar después de iniciar sesión (o si ya había sesión
 * activa al entrar a `/login`), validando que `from` —si lo hay— sea una
 * ruta que ESTE rol puede visitar.
 *
 * Sin esta validación, un `from` guardado por una sesión ANTERIOR se puede
 * colar a la de otro usuario: p. ej. un agente que cierra sesión estando en
 * `/admin/tiquetes` dispara el redirect-a-login-con-from de
 * `ProtectedRoute` (`state: { from: '/admin/tiquetes' }`); si el usuario
 * que inicia sesión después en esa misma pestaña es un pasajero, heredaría
 * ese `from` y aterrizaría en "Acceso denegado" en vez de "/". Si `from`
 * apunta a una zona que el rol actual no puede ver, se ignora y se usa el
 * destino por defecto de `obtenerRutaInicioPorRol` en su lugar.
 */
export function calcularDestinoPostLogin(rol, from) {
  const rutaPorRol = obtenerRutaInicioPorRol(rol);
  if (!from) return rutaPorRol;

  const esRutaAdministrativa = from.startsWith('/admin');
  const rolEsAdministrativo = ROLES_ADMINISTRATIVOS.includes(rol);

  return esRutaAdministrativa === rolEsAdministrativo ? from : rutaPorRol;
}
