'use strict';

/**
 * Capa de Infraestructura — acceso a datos para el historial de vuelos de
 * un usuario. A diferencia de `tiquetesRepository`/`asientosRepository`
 * (que mutan datos bajo concurrencia y por eso usan `withTransaction` +
 * `SELECT ... FOR UPDATE`), esta es una consulta de solo lectura: no
 * requiere transacción ni bloqueo de filas, así que opera directo sobre
 * `pool` (mismo patrón que `vuelosRepository.buscarVuelosDisponibles` y
 * `asientosRepository.listarPorVuelo`).
 *
 * Toda la consulta usa parámetros posicionales ($1) vía `pg`, nunca
 * interpolación de strings, para eliminar el riesgo de SQL Injection.
 */

const { pool } = require('../../config/database');

const MOTIVO_USUARIO_NO_ENCONTRADO = 'USUARIO_NO_ENCONTRADO';

// JOIN tiquetes -> vuelos (Fecha, Vuelo, Ruta) -> asientos (qué asiento se
// ocupó). `estado` es el de tiquetes (PENDIENTE/CONFIRMADO/CANCELADO/
// REAGENDADO): a propósito no se filtra aquí, para que el historial
// muestre también reservas canceladas con su estado real, en vez de
// ocultarlas.
const QUERY_HISTORIAL_VUELOS = `
  SELECT
    t.id_tiquete,
    t.codigo_reserva,
    t.estado,
    t.precio_pagado,
    t.fecha_reserva,
    v.numero_vuelo,
    v.origen,
    v.destino,
    v.fecha_hora_salida,
    v.fecha_hora_llegada,
    a.codigo_asiento,
    a.clase AS clase_asiento
  FROM tiquetes t
  JOIN vuelos v ON v.id_vuelo = t.id_vuelo
  JOIN asientos a ON a.id_asiento = t.id_asiento
  WHERE t.id_pasajero = $1
  ORDER BY v.fecha_hora_salida DESC
`;

function mapearHistorialACamelCase(fila) {
  return {
    idTiquete: fila.id_tiquete,
    codigoReserva: fila.codigo_reserva,
    numeroVuelo: fila.numero_vuelo,
    origen: fila.origen,
    destino: fila.destino,
    ruta: `${fila.origen} - ${fila.destino}`,
    fechaHoraSalida: fila.fecha_hora_salida,
    fechaHoraLlegada: fila.fecha_hora_llegada,
    asiento: {
      codigoAsiento: fila.codigo_asiento,
      clase: fila.clase_asiento,
    },
    estado: fila.estado,
    precioPagado: Number(fila.precio_pagado),
    fechaReserva: fila.fecha_reserva,
  };
}

/**
 * @param {string} usuarioId
 * @returns {Promise<{ ok: true, historial: object[] } | { ok: false, motivo: string }>}
 */
async function obtenerHistorialVuelos(usuarioId) {
  // Se verifica la existencia del usuario por separado (en vez de inferirla
  // de `historialResult.rowCount === 0`) para poder distinguir "usuario sin
  // tiquetes todavía" (200 con arreglo vacío) de "usuario inexistente"
  // (404), igual que `asientosRepository.listarPorVuelo` distingue "vuelo
  // sin asientos" de "vuelo inexistente".
  const usuarioResult = await pool.query('SELECT id_usuario FROM usuarios WHERE id_usuario = $1', [
    usuarioId,
  ]);

  if (usuarioResult.rowCount === 0) {
    return { ok: false, motivo: MOTIVO_USUARIO_NO_ENCONTRADO };
  }

  const historialResult = await pool.query(QUERY_HISTORIAL_VUELOS, [usuarioId]);

  return { ok: true, historial: historialResult.rows.map(mapearHistorialACamelCase) };
}

module.exports = { obtenerHistorialVuelos, MOTIVO_USUARIO_NO_ENCONTRADO };
