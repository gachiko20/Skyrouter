'use strict';

/**
 * Capa de Infraestructura — servidor de WebSockets (Socket.IO) para
 * sincronización en tiempo real del mapa de asientos (HU-02, SCRUM-8).
 *
 * Patrón de "sala por vuelo": cada cliente conectado se une a la sala
 * `vuelo:<id>` del vuelo que está mirando (evento `unirse_vuelo`), para que
 * las actualizaciones de un vuelo no le lleguen a clientes mirando otro.
 *
 * `io` es un singleton de módulo (no se inyecta por parámetro como los
 * repositorios) porque lo necesitan controladores HTTP normales
 * (`asientosController`, `checkoutController`) y el cron job
 * (`expirarBloqueosJob`), todos ajenos entre sí; inicializarlo una sola vez
 * desde `server.js` y exponer `emitirAsientosActualizados` como punto único
 * de emisión evita pasar la instancia de `io` a través de capas que no
 * deberían conocerla (casos de uso, repositorios).
 */

const { Server } = require('socket.io');
const asientosRepository = require('../repositories/asientosRepository');

const EVENTO_ASIENTOS_ACTUALIZADOS = 'asientos_actualizados';
const EVENTO_UNIRSE_VUELO = 'unirse_vuelo';
const EVENTO_SALIR_VUELO = 'salir_vuelo';

let io = null;

function nombreSalaVuelo(vueloId) {
  return `vuelo:${vueloId}`;
}

/**
 * Adjunta Socket.IO al servidor HTTP ya creado en `server.js` (no a
 * `app.js`: Socket.IO necesita el `http.Server` crudo, y `app.js` lo
 * importan directo los tests de integración vía supertest sin levantar un
 * servidor real).
 *
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    socket.on(EVENTO_UNIRSE_VUELO, (vueloId) => {
      if (!vueloId) return;
      socket.join(nombreSalaVuelo(vueloId));
    });

    socket.on(EVENTO_SALIR_VUELO, (vueloId) => {
      if (!vueloId) return;
      socket.leave(nombreSalaVuelo(vueloId));
    });
  });

  console.log('[websocket] Servidor Socket.IO inicializado.');
  return io;
}

/**
 * Vuelve a consultar el mapa de asientos de `vueloId` (misma fuente de
 * verdad que `GET /api/vuelos/:vueloId/asientos`) y lo emite a todos los
 * clientes unidos a su sala. Se llama tras CUALQUIER mutación que cambie la
 * disponibilidad de un asiento para ese vuelo:
 *   - bloqueo temporal exitoso (`POST /api/asientos/bloquear`)
 *   - compra confirmada (`POST /api/tiquetes/checkout`)
 *   - expiración automática de bloqueos vencidos (`expirarBloqueosJob`)
 *
 * Se emite el mapa completo (no solo el asiento que cambió) a propósito:
 * es la misma forma que ya consume `PlanoCabina.jsx` al cargar la página,
 * así que el frontend puede hacer `setAsientos(payload.asientos)`
 * directamente, sin lógica de merge/diff adicional ni riesgo de que un
 * cliente quede con una vista parcialmente desincronizada.
 *
 * No-op silencioso si el servidor de WebSockets no se ha inicializado (p.
 * ej. `tests/integration/*.test.js`, que usan supertest directo sobre
 * `app.js` sin levantar `server.js`) o si el vuelo ya no existe.
 *
 * @param {string} vueloId
 * @returns {Promise<void>}
 */
async function emitirAsientosActualizados(vueloId) {
  if (!io) return;

  try {
    const resultado = await asientosRepository.listarPorVuelo(vueloId);
    if (!resultado.ok) return;

    io.to(nombreSalaVuelo(vueloId)).emit(EVENTO_ASIENTOS_ACTUALIZADOS, {
      vueloId,
      asientos: resultado.asientos,
    });
  } catch (error) {
    console.error(`[websocket] Error emitiendo ${EVENTO_ASIENTOS_ACTUALIZADOS} (vuelo ${vueloId}):`, error);
  }
}

module.exports = {
  initSocketServer,
  emitirAsientosActualizados,
  EVENTO_ASIENTOS_ACTUALIZADOS,
  EVENTO_UNIRSE_VUELO,
  EVENTO_SALIR_VUELO,
};
