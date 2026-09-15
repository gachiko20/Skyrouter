'use strict';

/**
 * Lógica de negocio de reserva de asientos: bloqueo pesimista (SCRUM-6).
 *
 * --------------------------------------------------------------------------
 * NOTA DE DISEÑO — adaptación al esquema real (SCRUM-5, database/init.sql)
 * --------------------------------------------------------------------------
 * `asientos` modela el mapa FÍSICO de un avión: el mismo asiento (ej. "12A")
 * se reutiliza en TODOS los vuelos de esa aeronave. Por eso `asientos.estado`
 * es un campo administrativo (mantenimiento/fuera de servicio) y NO puede
 * usarse como "ocupado para este vuelo": si lo pusiéramos en 'RESERVADO' al
 * reservar, ese asiento quedaría inhabilitado para CUALQUIER OTRO vuelo del
 * mismo avión, lo cual es incorrecto.
 *
 * La disponibilidad real por vuelo la garantiza el índice único parcial
 * `uq_tiquetes_vuelo_asiento_activo` sobre
 * `tiquetes (id_vuelo, id_asiento) WHERE estado <> 'CANCELADO'`.
 *
 * Estrategia de bloqueo pesimista aplicada aquí:
 *   1. `SELECT ... FOR UPDATE` sobre la fila de `asientos` (el único recurso
 *      ya persistido que representa ese asiento) para SERIALIZAR cualquier
 *      transacción concurrente que intente tocar ese mismo asiento físico,
 *      sin importar el vuelo.
 *   2. Bajo ese lock, se verifica si ya existe un tiquete activo para
 *      (vuelo, asiento). Ninguna otra transacción pudo insertar uno sin
 *      esperar a que esta termine, así que la lectura es libre de carreras.
 *   3. Se inserta el tiquete. El índice único parcial actúa además como
 *      red de seguridad a nivel de base de datos (defensa en profundidad)
 *      por si este servicio se saltara el paso 1/2 por error.
 */

const { withTransaction } = require('../config/database');
const { ConflictError, NotFoundError } = require('../errors/AppError');

const PG_UNIQUE_VIOLATION = '23505';
const MAX_INTENTOS_CODIGO_RESERVA = 3;

const MENSAJE_ASIENTO_NO_DISPONIBLE =
  'El asiento ya ha sido seleccionado o reservado por otro usuario.';

/**
 * Genera un código de reserva de 6 caracteres alfanuméricos en mayúsculas,
 * compatible con `ck_tiquetes_codigo_reserva_formato` (^[A-Z0-9]{6}$).
 */
function generarCodigoReserva() {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let codigo = '';
  for (let i = 0; i < 6; i += 1) {
    codigo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return codigo;
}

/**
 * Intenta reservar `asientoId` en `vueloId` para `usuarioId` dentro de una
 * única transacción atómica con bloqueo preventivo a nivel de fila.
 *
 * @param {string} vueloId    UUID del vuelo.
 * @param {string} asientoId  UUID del asiento.
 * @param {string} usuarioId  UUID del pasajero que reserva.
 * @returns {Promise<object>} El tiquete creado.
 * @throws {NotFoundError}  Si el asiento no existe o no pertenece al avión de ese vuelo.
 * @throws {ConflictError}  Con code 'ASIENTO_NO_DISPONIBLE' si el asiento ya está tomado.
 */
async function bloquearAsiento(vueloId, asientoId, usuarioId) {
  return withTransaction(async (client) => {
    // (a) Bloqueo exclusivo de la fila del asiento físico, validando en el
    // mismo query que pertenece al avión asignado a este vuelo.
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
      throw new NotFoundError(
        'El asiento indicado no existe o no pertenece al avión asignado a este vuelo.',
        'ASIENTO_NO_ENCONTRADO'
      );
    }

    const asiento = asientoResult.rows[0];

    // (b) Validación estricta de disponibilidad administrativa del asiento
    // (p. ej. bloqueado por mantenimiento a nivel de aeronave).
    if (asiento.estado !== 'DISPONIBLE') {
      throw new ConflictError(MENSAJE_ASIENTO_NO_DISPONIBLE, 'ASIENTO_NO_DISPONIBLE');
    }

    // Disponibilidad real para ESTE vuelo: ¿ya hay un tiquete activo?
    // Segura gracias al lock adquirido en el paso (a).
    const tiqueteExistente = await client.query(
      `SELECT id_tiquete
         FROM tiquetes
        WHERE id_vuelo = $1
          AND id_asiento = $2
          AND estado <> 'CANCELADO'
        LIMIT 1`,
      [vueloId, asientoId]
    );

    if (tiqueteExistente.rowCount > 0) {
      throw new ConflictError(MENSAJE_ASIENTO_NO_DISPONIBLE, 'ASIENTO_NO_DISPONIBLE');
    }

    // (c)+(d) Confirmación de la reserva (creación directa del tiquete).
    // Se reintenta solo ante colisión del código de reserva aleatorio
    // (probabilidad ínfima, pero no nula con 36^6 combinaciones).
    let tiqueteCreado = null;
    for (let intento = 1; intento <= MAX_INTENTOS_CODIGO_RESERVA; intento += 1) {
      const codigoReserva = generarCodigoReserva();
      try {
        const insertResult = await client.query(
          `INSERT INTO tiquetes (codigo_reserva, id_vuelo, id_pasajero, id_asiento, estado, precio_pagado)
           VALUES ($1, $2, $3, $4, 'CONFIRMADO', $5)
           RETURNING id_tiquete, codigo_reserva, id_vuelo, id_pasajero, id_asiento, estado, precio_pagado, fecha_reserva`,
          [codigoReserva, vueloId, usuarioId, asientoId, asiento.precio_base]
        );
        tiqueteCreado = insertResult.rows[0];
        break;
      } catch (error) {
        const esColisionCodigoReserva =
          error.code === PG_UNIQUE_VIOLATION && error.constraint === 'uq_tiquetes_codigo_reserva';

        if (esColisionCodigoReserva && intento < MAX_INTENTOS_CODIGO_RESERVA) {
          continue; // Código de reserva duplicado: reintentar con uno nuevo.
        }

        if (error.code === PG_UNIQUE_VIOLATION) {
          // Red de seguridad: uq_tiquetes_vuelo_asiento_activo (u otra
          // única) impidió el insert pese al lock anterior.
          throw new ConflictError(MENSAJE_ASIENTO_NO_DISPONIBLE, 'ASIENTO_NO_DISPONIBLE');
        }

        throw error;
      }
    }

    return tiqueteCreado;
  });
}

module.exports = { bloquearAsiento, generarCodigoReserva };
