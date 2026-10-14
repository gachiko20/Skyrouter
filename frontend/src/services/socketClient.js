import { io } from 'socket.io-client';

// El servidor de Socket.IO se adjunta al mismo `http.Server` de la API REST
// (ver `src/server.js` del backend), en la raíz (sin el prefijo `/api` que
// sí usa axios): de ahí `VITE_API_BASE_URL` menos ese sufijo, en vez de una
// env var nueva que pueda desincronizarse de la URL real del backend.
const SOCKET_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace(
  /\/api\/?$/,
  ''
);

export const EVENTO_UNIRSE_VUELO = 'unirse_vuelo';
export const EVENTO_SALIR_VUELO = 'salir_vuelo';
export const EVENTO_ASIENTOS_ACTUALIZADOS = 'asientos_actualizados';

/**
 * Abre una conexión de Socket.IO al backend (HU-02, SCRUM-8: sincronización
 * en tiempo real del mapa de asientos).
 *
 * Aislado en su propio módulo (en vez de llamar `io()` directo desde
 * `PlanoCabina.jsx`) por el mismo motivo que `asientosApi.js`/`vuelosApi.js`
 * aíslan `import.meta.env`: esa sintaxis no la soporta el transform de
 * Babel/Jest, así que cualquier componente que la use directamente rompe al
 * testearlo. Encapsulándola aquí, el test de `PlanoCabina` puede mockear
 * este módulo completo (`jest.mock('.../socketClient.js')`) igual que ya
 * mockea `asientosApi.js`, en vez de arrastrar esta restricción al
 * componente.
 *
 * Se expone como función (no un singleton ya conectado) para que cada
 * consumidor controle su propio ciclo de vida de conexión/desconexión.
 *
 * @returns {import('socket.io-client').Socket}
 */
export function conectarSocket() {
  return io(SOCKET_URL, { transports: ['websocket'] });
}

export default { conectarSocket, EVENTO_UNIRSE_VUELO, EVENTO_SALIR_VUELO, EVENTO_ASIENTOS_ACTUALIZADOS };
