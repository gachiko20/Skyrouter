'use strict';

/**
 * Capa de Infraestructura — acceso a datos para el checkout de pago
 * (confirmación de compra: "futura HU de pago" mencionada en
 * `database/init.sql`, ck_tiquetes_estado).
 *
 * --------------------------------------------------------------------------
 * NOTA DE DISEÑO — por qué NO se toca `asientos.estado`
 * --------------------------------------------------------------------------
 * `asientos` modela el mapa FÍSICO de un avión (se reutiliza en todos sus
 * vuelos, ver `CONCURRENCY.md`). Poner `asientos.estado = 'OCUPADO'` al
 * confirmar una compra inhabilitaría ese asiento físico en TODOS los demás
 * vuelos de la misma aeronave, lo cual es incorrecto. La disponibilidad
 * *por vuelo* (y la garantía real de 0% overbooking) la da el índice único
 * parcial `uq_tiquetes_vuelo_asiento_activo` sobre
 * `tiquetes (id_vuelo, id_asiento) WHERE estado <> 'CANCELADO'`, exactamente
 * igual que en SCRUM-6 (`services/asientosService.js`) y HU-02
 * (`asientosRepository.bloquearAsientoTemporal`). Este repositorio sigue el
 * mismo patrón: bloqueo pesimista sobre la fila física del asiento +
 * verificación de tiquetes activos, dentro de una única transacción.
 */

const { pool, withTransaction } = require('../../config/database');

const PG_UNIQUE_VIOLATION = '23505';
const MAX_INTENTOS_CODIGO_RESERVA = 3;

const MOTIVO_ASIENTO_NO_ENCONTRADO = 'ASIENTO_NO_ENCONTRADO';
const MOTIVO_ASIENTO_NO_DISPONIBLE = 'ASIENTO_NO_DISPONIBLE';
const MOTIVO_PASAJERO_NO_ENCONTRADO = 'PASAJERO_NO_ENCONTRADO';

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
    fechaReserva: fila.fecha_reserva,
  };
}

/**
 * Confirma la compra de `asientoId` en `vueloId` para `pasajeroId` dentro de
 * una única transacción atómica (BEGIN/COMMIT/ROLLBACK vía `withTransaction`)
 * con bloqueo preventivo a nivel de fila:
 *
 *   1. `SELECT ... FOR UPDATE OF a` — bloquea la fila física del asiento,
 *      serializando cualquier transacción concurrente sobre ese mismo
 *      asiento (mismo mecanismo que SCRUM-6/HU-02).
 *   2. Bajo ese lock: valida disponibilidad administrativa del asiento y
 *      que el pasajero exista.
 *   3. Si ya existe un tiquete PENDIENTE para (vuelo, asiento) del MISMO
 *      pasajero (bloqueo temporal previo de HU-02/SCRUM-8), se confirma esa
 *      misma fila (transición PENDIENTE -> CONFIRMADO) en vez de intentar
 *      insertar una nueva: son la misma reserva completando su ciclo de
 *      vida, no dos tiquetes en pugna por el índice único. Si el tiquete
 *      activo es de otro pasajero, o ya está CONFIRMADO, es un conflicto
 *      real. Si no hay ningún tiquete activo (compra directa sin bloqueo
 *      previo), se inserta uno nuevo ya CONFIRMADO con un código de reserva
 *      único.
 *
 * @param {{ vueloId: string, asientoId: string, pasajeroId: string }} params
 * @returns {Promise<{ ok: true, tiquete: object } | { ok: false, motivo: string }>}
 */
async function confirmarCompra({ vueloId, asientoId, pasajeroId }) {
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

    const pasajeroResult = await client.query(
      'SELECT id_usuario FROM usuarios WHERE id_usuario = $1',
      [pasajeroId]
    );

    if (pasajeroResult.rowCount === 0) {
      return { ok: false, motivo: MOTIVO_PASAJERO_NO_ENCONTRADO };
    }

    const activoResult = await client.query(
      `SELECT id_tiquete, id_pasajero, estado
         FROM tiquetes
        WHERE id_vuelo = $1
          AND id_asiento = $2
          AND estado <> 'CANCELADO'
        LIMIT 1`,
      [vueloId, asientoId]
    );

    if (activoResult.rowCount > 0) {
      const tiqueteActivo = activoResult.rows[0];
      const esBloqueoPropioPendiente =
        tiqueteActivo.estado === 'PENDIENTE' && tiqueteActivo.id_pasajero === pasajeroId;

      if (!esBloqueoPropioPendiente) {
        return { ok: false, motivo: MOTIVO_ASIENTO_NO_DISPONIBLE };
      }

      const confirmarResult = await client.query(
        `UPDATE tiquetes
            SET estado = 'CONFIRMADO', fecha_expiracion = NULL
          WHERE id_tiquete = $1
          RETURNING id_tiquete, codigo_reserva, id_vuelo, id_pasajero, id_asiento, estado, precio_pagado, fecha_reserva`,
        [tiqueteActivo.id_tiquete]
      );

      return { ok: true, tiquete: mapearTiqueteACamelCase(confirmarResult.rows[0]) };
    }

    for (let intento = 1; intento <= MAX_INTENTOS_CODIGO_RESERVA; intento += 1) {
      const codigoReserva = generarCodigoReserva();
      try {
        // eslint-disable-next-line no-await-in-loop
        const insertResult = await client.query(
          `INSERT INTO tiquetes (codigo_reserva, id_vuelo, id_pasajero, id_asiento, estado, precio_pagado)
           VALUES ($1, $2, $3, $4, 'CONFIRMADO', $5)
           RETURNING id_tiquete, codigo_reserva, id_vuelo, id_pasajero, id_asiento, estado, precio_pagado, fecha_reserva`,
          [codigoReserva, vueloId, pasajeroId, asientoId, asiento.precio_base]
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
 * Datos necesarios para la factura de un tiquete (pasajero, vuelo, asiento
 * y precio pagado), en una sola consulta. Solo lectura: no requiere
 * transacción ni locks.
 *
 * @param {string} tiqueteId
 * @returns {Promise<object | null>} `null` si el tiquete no existe.
 */
async function obtenerDatosFactura(tiqueteId) {
  const resultado = await pool.query(
    `SELECT t.id_tiquete, t.codigo_reserva, t.id_pasajero, t.estado, t.precio_pagado, t.fecha_reserva,
            u.nombres, u.apellidos, u.correo_electronico, u.documento_identidad,
            v.numero_vuelo, v.origen, v.destino, v.fecha_hora_salida, v.fecha_hora_llegada,
            a.codigo_asiento, a.clase
       FROM tiquetes t
       JOIN usuarios u ON u.id_usuario = t.id_pasajero
       JOIN vuelos v   ON v.id_vuelo   = t.id_vuelo
       JOIN asientos a ON a.id_asiento = t.id_asiento
      WHERE t.id_tiquete = $1`,
    [tiqueteId]
  );

  if (resultado.rowCount === 0) {
    return null;
  }

  const fila = resultado.rows[0];
  return {
    idTiquete: fila.id_tiquete,
    codigoReserva: fila.codigo_reserva,
    idPasajero: fila.id_pasajero,
    estado: fila.estado,
    precioPagado: Number(fila.precio_pagado),
    fechaReserva: fila.fecha_reserva,
    pasajero: {
      nombreCompleto: `${fila.nombres} ${fila.apellidos}`,
      correo: fila.correo_electronico,
      documentoIdentidad: fila.documento_identidad,
    },
    vuelo: {
      numeroVuelo: fila.numero_vuelo,
      origen: fila.origen,
      destino: fila.destino,
      fechaHoraSalida: fila.fecha_hora_salida,
      fechaHoraLlegada: fila.fecha_hora_llegada,
    },
    asiento: {
      codigoAsiento: fila.codigo_asiento,
      clase: fila.clase,
    },
  };
}

module.exports = {
  confirmarCompra,
  obtenerDatosFactura,
  MOTIVO_ASIENTO_NO_ENCONTRADO,
  MOTIVO_ASIENTO_NO_DISPONIBLE,
  MOTIVO_PASAJERO_NO_ENCONTRADO,
};
