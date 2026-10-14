'use strict';

/**
 * Capa de Infraestructura — job programado de expiración de bloqueos
 * temporales de asientos (HU-02, SCRUM-8).
 *
 * --------------------------------------------------------------------------
 * NOTA DE DISEÑO — por qué el estado liberado es 'CANCELADO' en `tiquetes`,
 * no 'DISPONIBLE' en `asientos`
 * --------------------------------------------------------------------------
 * `asientos.estado` es administrativo y físico (mantenimiento, etc.), no
 * "ocupado para este vuelo" — por eso `ck_asientos_estado` ni siquiera
 * admite el valor 'DISPONIBLE' como transición de negocio aquí, y tocar esa
 * columna marcaría el asiento como fuera de servicio en TODOS los vuelos de
 * esa aeronave (ver nota de diseño en `asientosRepository.js`/
 * `CONCURRENCY.md`). El bloqueo temporal vive como una fila en `tiquetes`
 * con estado 'PENDIENTE'; liberarlo es llevar ESA fila a 'CANCELADO' (único
 * valor de `ck_tiquetes_estado` que el índice único parcial
 * `uq_tiquetes_vuelo_asiento_activo` excluye), que es exactamente lo que
 * vuelve a dejar el asiento disponible PARA ESE VUELO.
 */

const cron = require('node-cron');
const { pool } = require('../../config/database');
const { emitirAsientosActualizados } = require('../websocket/socketServer');

// Configurable por env var (p. ej. para pruebas manuales de la expiración
// sin recompilar) sin alterar la frecuencia de negocio por defecto si no se
// define. Ver también `CRON_EXPIRACION_BLOQUEOS` en `.env.example`. Acepta
// el campo opcional de segundos de node-cron (6 campos, p. ej. '*/15 * * * * *').
const EXPRESION_CRON_EXPIRACION_BLOQUEOS = process.env.CRON_EXPIRACION_BLOQUEOS || '* * * * *';

const QUERY_EXPIRAR_BLOQUEOS_VENCIDOS = `
  UPDATE tiquetes
     SET estado = 'CANCELADO',
         fecha_expiracion = NULL
   WHERE estado = 'PENDIENTE'
     AND fecha_expiracion IS NOT NULL
     AND fecha_expiracion < NOW()
  RETURNING id_vuelo
`;

/**
 * Libera (cancela) todos los bloqueos temporales ('PENDIENTE') cuya
 * `fecha_expiracion` ya pasó, y notifica por WebSocket a cada vuelo
 * afectado para que su mapa de asientos se refresque en vivo en todos los
 * clientes que lo tengan abierto.
 *
 * Exportada (además de `iniciarJobExpiracionBloqueos`) para poder invocarla
 * directamente desde un test de integración, sin depender del scheduler.
 *
 * @returns {Promise<number>} Cantidad de bloqueos liberados.
 */
async function expirarBloqueosVencidos() {
  const resultado = await pool.query(QUERY_EXPIRAR_BLOQUEOS_VENCIDOS);

  if (resultado.rowCount === 0) return 0;

  const vuelosAfectados = [...new Set(resultado.rows.map((fila) => fila.id_vuelo))];
  console.log(
    `[cron] Liberados ${resultado.rowCount} bloqueo(s) temporal(es) vencido(s) en ${vuelosAfectados.length} vuelo(s).`
  );

  await Promise.all(vuelosAfectados.map((vueloId) => emitirAsientosActualizados(vueloId)));

  return resultado.rowCount;
}

/** Programa `expirarBloqueosVencidos` según `EXPRESION_CRON_EXPIRACION_BLOQUEOS`. Se llama una sola vez desde `server.js`. */
function iniciarJobExpiracionBloqueos() {
  cron.schedule(EXPRESION_CRON_EXPIRACION_BLOQUEOS, () => {
    expirarBloqueosVencidos().catch((error) => {
      console.error('[cron] Error liberando bloqueos vencidos:', error);
    });
  });
  console.log(
    `[cron] Job de expiración de bloqueos temporales programado (expresión: "${EXPRESION_CRON_EXPIRACION_BLOQUEOS}").`
  );
}

module.exports = { iniciarJobExpiracionBloqueos, expirarBloqueosVencidos };
