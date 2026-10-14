'use strict';

/**
 * Capa de Infraestructura — acceso a datos real para la búsqueda de
 * vuelos (HU-01). Toda la consulta usa parámetros posicionales ($1, $2,
 * $3) vía `pg`, nunca interpolación de strings, para eliminar el riesgo de
 * SQL Injection.
 *
 * --------------------------------------------------------------------------
 * NOTA DE DISEÑO — disponibilidad real por vuelo (coherente con SCRUM-5/6)
 * --------------------------------------------------------------------------
 * `asientos` es el mapa FÍSICO de un avión y se reutiliza en todos sus
 * vuelos; `asientos.estado` solo indica si el asiento está habilitado a
 * nivel de aeronave (p. ej. bloqueado por mantenimiento), NO si ya fue
 * vendido en un vuelo concreto. La venta por vuelo vive en `tiquetes`
 * (ver índice único parcial `uq_tiquetes_vuelo_asiento_activo`, SCRUM-6).
 *
 * Por lo tanto, "asientos disponibles para este vuelo" = asientos
 * físicamente habilitados (`estado = 'DISPONIBLE'`) QUE ADEMÁS no tengan
 * ya un tiquete activo (`estado <> 'CANCELADO'`) para ese `id_vuelo`
 * específico. Eso es exactamente lo que calcula el `COUNT(...) FILTER`
 * de abajo, agrupado por vuelo.
 */

const { pool } = require('../../config/database');

const QUERY_BUSCAR_VUELOS = `
  SELECT
    v.id_vuelo,
    v.numero_vuelo,
    v.origen,
    v.destino,
    v.fecha_hora_salida,
    v.fecha_hora_llegada,
    v.precio_base,
    av.modelo      AS avion_modelo,
    av.fabricante  AS avion_fabricante,
    COUNT(a.id_asiento) FILTER (
      WHERE a.estado = 'DISPONIBLE' AND t.id_tiquete IS NULL
    ) AS asientos_disponibles
  FROM vuelos v
  JOIN aviones av ON av.id_avion = v.id_avion
  LEFT JOIN asientos a ON a.id_avion = av.id_avion
  LEFT JOIN tiquetes t
    ON t.id_asiento = a.id_asiento
   AND t.id_vuelo = v.id_vuelo
   AND t.estado <> 'CANCELADO'
  WHERE v.origen = $1
    AND v.destino = $2
    -- El día se evalúa en hora de Colombia, no en la zona de la sesión
    -- (UTC en Docker): sin esto, un vuelo de las 19:00 -05 (00:00 UTC)
    -- aparecería al buscar el día siguiente.
    AND (v.fecha_hora_salida AT TIME ZONE 'America/Bogota')::date = $3::date
    AND v.estado <> 'CANCELADO'
  GROUP BY v.id_vuelo, av.id_avion
  ORDER BY v.fecha_hora_salida ASC
`;

/**
 * @param {{origen: string, destino: string, fecha: string}} criterios  Ya normalizados/validados por el caso de uso.
 * @returns {Promise<object[]>} Vuelos disponibles, en camelCase, listos para la capa de presentación.
 */
async function buscarVuelosDisponibles({ origen, destino, fecha }) {
  const { rows } = await pool.query(QUERY_BUSCAR_VUELOS, [origen, destino, fecha]);

  return rows.map((fila) => ({
    idVuelo: fila.id_vuelo,
    numeroVuelo: fila.numero_vuelo,
    origen: fila.origen,
    destino: fila.destino,
    fechaHoraSalida: fila.fecha_hora_salida,
    fechaHoraLlegada: fila.fecha_hora_llegada,
    precioBase: Number(fila.precio_base),
    avion: {
      modelo: fila.avion_modelo,
      fabricante: fila.avion_fabricante,
    },
    asientosDisponibles: Number(fila.asientos_disponibles),
  }));
}

module.exports = { buscarVuelosDisponibles };
