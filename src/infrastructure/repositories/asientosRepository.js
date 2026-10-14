'use strict';

/**
 * Capa de Infraestructura — acceso a datos para el bloqueo temporal de
 * asientos (HU-02, SCRUM-8).
 *
 * --------------------------------------------------------------------------
 * NOTA DE DISEÑO — relación con SCRUM-6 y el esquema físico (SCRUM-5)
 * --------------------------------------------------------------------------
 * `asientos` modela el mapa FÍSICO de un avión (se reutiliza en todos sus
 * vuelos), así que `asientos.estado` es administrativo y NO puede usarse
 * como "bloqueado para este vuelo" sin inhabilitar el asiento en el resto
 * de vuelos de la misma aeronave (ver `database/README.md` y
 * `CONCURRENCY.md`). Por eso el bloqueo *por vuelo* que pide esta historia
 * se modela, igual que en SCRUM-6, como una fila en `tiquetes`:
 *
 *   - estado = 'PENDIENTE'  -> bloqueo temporal de selección (esta HU).
 *   - estado = 'CONFIRMADO' -> reserva/compra definitiva (SCRUM-6/futura HU de pago).
 *
 * El índice único parcial `uq_tiquetes_vuelo_asiento_activo` (WHERE estado
 * <> 'CANCELADO') protege ambos estados por igual: no puede coexistir más
 * de un tiquete PENDIENTE o CONFIRMADO para el mismo (vuelo, asiento). Esa
 * es la garantía real de 0% overbooking, reforzada aquí con bloqueo
 * pesimista (`SELECT ... FOR UPDATE`) para que el conflicto se detecte de
 * forma determinística y no dependa de reintentos en la capa de aplicación.
 *
 * El ciclo BEGIN/COMMIT/ROLLBACK se delega a `withTransaction`
 * (`config/database.js`) en vez de repetirlo aquí a mano: centraliza la
 * liberación del cliente del pool y evita fugas de conexión si el callback
 * lanza una excepción a mitad de camino (mismo patrón ya usado en SCRUM-6).
 */

const { pool, withTransaction } = require('../../config/database');

const PG_UNIQUE_VIOLATION = '23505';
const MAX_INTENTOS_CODIGO_RESERVA = 3;

// Configurable por env var (p. ej. para pruebas manuales de la expiración
// sin recompilar) sin alterar el valor de negocio por defecto si no se
// define. Ver también `MINUTOS_EXPIRACION_BLOQUEO_ASIENTO` en `.env.example`.
const MINUTOS_EXPIRACION_BLOQUEO_DEFECTO = Number(process.env.MINUTOS_EXPIRACION_BLOQUEO_ASIENTO) || 15;

const MOTIVO_ASIENTO_NO_ENCONTRADO = 'ASIENTO_NO_ENCONTRADO';
const MOTIVO_ASIENTO_NO_DISPONIBLE = 'ASIENTO_NO_DISPONIBLE';
const MOTIVO_VUELO_NO_ENCONTRADO = 'VUELO_NO_ENCONTRADO';

/** "12A" -> { fila: 12, columna: 'A' }, según el formato de `asientos.codigo_asiento` (^[0-9]{1,3}[A-Z]$). */
function parsearCodigoAsiento(codigoAsiento) {
  const coincidencia = /^(\d{1,3})([A-Z])$/.exec(codigoAsiento);
  return coincidencia
    ? { fila: Number(coincidencia[1]), columna: coincidencia[2] }
    : { fila: null, columna: codigoAsiento };
}

/**
 * Traduce una fila física de `asientos` (con el estado de su tiquete activo
 * para ESTE vuelo, si lo hay) al estado que le importa a la UI:
 *
 *   - Asiento inhabilitado a nivel de aeronave (mantenimiento, etc.)
 *     -> 'OCUPADO' (no vendible, sin importar el vuelo).
 *   - Tiquete PENDIENTE activo para este vuelo -> 'BLOQUEADO_TEMPORAL'
 *     (alguien más lo está pagando ahora mismo, HU-02).
 *   - Tiquete CONFIRMADO activo para este vuelo -> 'OCUPADO' (ya vendido).
 *   - Nada de lo anterior -> 'DISPONIBLE'.
 *
 * Mismo vocabulario de 3 estados que ya consume `PlanoCabina.jsx` en el
 * frontend (`Asiento.jsx`), para que este endpoint conecte directo con
 * `asientosIniciales` sin transformación adicional en el cliente.
 */
function mapearAsientoParaVuelo(fila) {
  const { fila: numeroFila, columna } = parsearCodigoAsiento(fila.codigo_asiento);

  let estado = 'DISPONIBLE';
  if (fila.estado_asiento !== 'DISPONIBLE') {
    estado = 'OCUPADO';
  } else if (fila.estado_tiquete === 'PENDIENTE') {
    estado = 'BLOQUEADO_TEMPORAL';
  } else if (fila.estado_tiquete === 'CONFIRMADO' || fila.estado_tiquete === 'REAGENDADO') {
    // REAGENDADO también es un tiquete activo (cuenta en
    // uq_tiquetes_vuelo_asiento_activo): el asiento está ocupado.
    estado = 'OCUPADO';
  }

  return {
    idAsiento: fila.id_asiento,
    codigoAsiento: fila.codigo_asiento,
    fila: numeroFila,
    columna,
    clase: fila.clase,
    estado,
  };
}

/** Código de reserva de 6 caracteres alfanuméricos en mayúsculas (^[A-Z0-9]{6}$). */
function generarCodigoReserva() {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let codigo = '';
  for (let i = 0; i < 6; i += 1) {
    codigo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return codigo;
}

function mapearTiqueteACamelCase(fila) {
  return {
    idTiquete: fila.id_tiquete,
    codigoReserva: fila.codigo_reserva,
    idVuelo: fila.id_vuelo,
    idPasajero: fila.id_pasajero,
    idAsiento: fila.id_asiento,
    estado: fila.estado,
    precioPagado: Number(fila.precio_pagado),
    fechaExpiracion: fila.fecha_expiracion,
  };
}

/**
 * Intenta bloquear temporalmente `asientoId` en `vueloId` para `usuarioId`.
 *
 * Transacción única con bloqueo preventivo a nivel de fila:
 *   1. `SELECT ... FOR UPDATE OF a` — bloquea la fila física del asiento,
 *      serializando cualquier intento concurrente sobre ese mismo asiento.
 *   2. Bajo ese lock, valida disponibilidad administrativa
 *      (`asientos.estado`) y si ya existe un tiquete activo (PENDIENTE o
 *      CONFIRMADO) para (vuelo, asiento) — lectura libre de carreras.
 *   3. Si está disponible, inserta el tiquete en estado PENDIENTE con su
 *      expiración; si no, retorna el motivo sin lanzar excepción (la
 *      decisión de qué error de negocio lanzar es responsabilidad del
 *      caso de uso, no de este repositorio).
 *
 * @param {{ vueloId: string, asientoId: string, usuarioId: string, minutosExpiracion?: number }} params
 * @returns {Promise<{ ok: true, tiquete: object } | { ok: false, motivo: string }>}
 */
async function bloquearAsientoTemporal({
  vueloId,
  asientoId,
  usuarioId,
  minutosExpiracion = MINUTOS_EXPIRACION_BLOQUEO_DEFECTO,
}) {
  return withTransaction(async (client) => {
    const asientoResult = await client.query(
      `SELECT a.id_asiento, a.estado, v.precio_base
         FROM asientos a
         JOIN vuelos v ON v.id_avion = a.id_avion
        WHERE a.id_asiento = $1
          AND v.id_vuelo = $2
        FOR UPDATE OF a`,
      [asientoId, vueloId]
    );

    if (asientoResult.rowCount === 0) {
      return { ok: false, motivo: MOTIVO_ASIENTO_NO_ENCONTRADO };
    }

    const asiento = asientoResult.rows[0];

    if (asiento.estado !== 'DISPONIBLE') {
      return { ok: false, motivo: MOTIVO_ASIENTO_NO_DISPONIBLE };
    }

    const activoResult = await client.query(
      `SELECT id_tiquete
         FROM tiquetes
        WHERE id_vuelo = $1
          AND id_asiento = $2
          AND estado <> 'CANCELADO'
        LIMIT 1`,
      [vueloId, asientoId]
    );

    if (activoResult.rowCount > 0) {
      return { ok: false, motivo: MOTIVO_ASIENTO_NO_DISPONIBLE };
    }

    for (let intento = 1; intento <= MAX_INTENTOS_CODIGO_RESERVA; intento += 1) {
      const codigoReserva = generarCodigoReserva();
      try {
        // eslint-disable-next-line no-await-in-loop
        const insertResult = await client.query(
          `INSERT INTO tiquetes (codigo_reserva, id_vuelo, id_pasajero, id_asiento, estado, precio_pagado, fecha_expiracion)
           VALUES ($1, $2, $3, $4, 'PENDIENTE', $5, now() + ($6 * interval '1 minute'))
           RETURNING id_tiquete, codigo_reserva, id_vuelo, id_pasajero, id_asiento, estado, precio_pagado, fecha_expiracion`,
          [codigoReserva, vueloId, usuarioId, asientoId, asiento.precio_base, minutosExpiracion]
        );

        return { ok: true, tiquete: mapearTiqueteACamelCase(insertResult.rows[0]) };
      } catch (error) {
        const esColisionCodigoReserva =
          error.code === PG_UNIQUE_VIOLATION && error.constraint === 'uq_tiquetes_codigo_reserva';

        if (esColisionCodigoReserva && intento < MAX_INTENTOS_CODIGO_RESERVA) {
          continue; // Código de reserva duplicado: reintentar con uno nuevo.
        }

        if (error.code === PG_UNIQUE_VIOLATION) {
          // Red de seguridad: uq_tiquetes_vuelo_asiento_activo impidió el
          // insert pese al lock anterior (defensa en profundidad).
          return { ok: false, motivo: MOTIVO_ASIENTO_NO_DISPONIBLE };
        }

        throw error;
      }
    }

    // Inalcanzable en la práctica (colisión de código de reserva 3 veces
    // seguidas con 36^6 combinaciones), pero mantiene el retorno exhaustivo.
    return { ok: false, motivo: MOTIVO_ASIENTO_NO_DISPONIBLE };
  });
}

/**
 * Lista el mapa de asientos del avión asignado a `vueloId`, con el estado
 * de cada asiento resuelto PARA ESE VUELO en particular (no el estado
 * físico crudo de `asientos.estado`).
 *
 * `asientos` está ligado al AVIÓN, no al vuelo (ver nota de diseño arriba):
 * por eso se hace JOIN vuelos -> asientos vía `id_avion`, y un LEFT JOIN
 * adicional a `tiquetes` filtrado por `id_vuelo` para saber si, para ESTE
 * vuelo específico, alguno de esos asientos físicos ya tiene un tiquete
 * activo (bloqueado temporalmente o comprado).
 *
 * Es una consulta de solo lectura: no requiere `withTransaction` (no hay
 * escritura ni necesidad de `FOR UPDATE`) y usa `pool` directamente, igual
 * que `vuelosRepository.buscarVuelosDisponibles`.
 *
 * @param {string} vueloId
 * @returns {Promise<{ ok: true, asientos: object[] } | { ok: false, motivo: string }>}
 */
async function listarPorVuelo(vueloId) {
  const vueloResult = await pool.query('SELECT id_vuelo FROM vuelos WHERE id_vuelo = $1', [vueloId]);

  if (vueloResult.rowCount === 0) {
    return { ok: false, motivo: MOTIVO_VUELO_NO_ENCONTRADO };
  }

  const asientosResult = await pool.query(
    `SELECT
        a.id_asiento,
        a.codigo_asiento,
        a.clase,
        a.estado AS estado_asiento,
        t.estado AS estado_tiquete
       FROM vuelos v
       JOIN asientos a ON a.id_avion = v.id_avion
       LEFT JOIN tiquetes t
         ON t.id_asiento = a.id_asiento
        AND t.id_vuelo = v.id_vuelo
        AND t.estado <> 'CANCELADO'
      WHERE v.id_vuelo = $1
      ORDER BY a.codigo_asiento`,
    [vueloId]
  );

  return { ok: true, asientos: asientosResult.rows.map(mapearAsientoParaVuelo) };
}

module.exports = {
  bloquearAsientoTemporal,
  listarPorVuelo,
  MOTIVO_ASIENTO_NO_ENCONTRADO,
  MOTIVO_ASIENTO_NO_DISPONIBLE,
  MOTIVO_VUELO_NO_ENCONTRADO,
};
