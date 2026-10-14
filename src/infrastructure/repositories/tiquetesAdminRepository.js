'use strict';

/**
 * Capa de Infraestructura — acceso a datos para la gestión administrativa de
 * tiquetes (SCRUM-10): cancelación y reagendamiento por un agente comercial
 * o administrador.
 *
 * --------------------------------------------------------------------------
 * NOTA DE DISEÑO — por qué NO se toca `asientos.estado`, y cómo se modela
 * "liberar"/"ocupar" un asiento POR VUELO
 * --------------------------------------------------------------------------
 * Mismo principio que `asientosRepository.js`/`tiquetesRepository.js`:
 * `asientos` es el mapa FÍSICO de un avión (compartido por todos sus
 * vuelos), así que `asientos.estado` nunca representa "ocupado para este
 * vuelo" — eso inhabilitaría el asiento en el resto de vuelos de la misma
 * aeronave. La disponibilidad *por vuelo* la da, siempre, el índice único
 * parcial `uq_tiquetes_vuelo_asiento_activo` sobre
 * `tiquetes (id_vuelo, id_asiento) WHERE estado <> 'CANCELADO'`.
 *
 * Con eso en mente:
 *   - CANCELAR "libera" el asiento de ese vuelo con un solo UPDATE:
 *     `tiquetes.estado = 'CANCELADO'`. En cuanto esa fila deja de contar
 *     como activa, el índice único vuelve a permitir una nueva reserva para
 *     ese (vuelo, asiento).
 *   - REAGENDAR mueve la MISMA fila de tiquete a otro (vuelo, asiento) con
 *     un solo UPDATE de `id_vuelo`/`id_asiento`/`estado = 'REAGENDADO'` (no
 *     se inserta una fila nueva ni se cancela la vieja por separado): el
 *     trigger `trg_tiquetes_validar_asiento_avion` de `database/init.sql`
 *     está definido explícitamente `BEFORE UPDATE OF id_vuelo, id_asiento`,
 *     lo que confirma que este es el mecanismo que el esquema ya
 *     contemplaba para un reagendamiento. El (vuelo, asiento) ANTERIOR
 *     queda libre porque la fila ya no lo referencia; el NUEVO queda
 *     ocupado porque esa misma fila (con estado REAGENDADO, que cuenta como
 *     "activo") ahora sí lo referencia — protegido por el mismo índice
 *     único, reforzado aquí con bloqueo pesimista (`SELECT ... FOR UPDATE`)
 *     sobre la fila física del nuevo asiento, igual que en
 *     `asientosRepository.bloquearAsientoTemporal`/
 *     `tiquetesRepository.confirmarCompra`.
 */

const { pool, withTransaction } = require('../../config/database');

const PG_UNIQUE_VIOLATION = '23505';
const LIMITE_BUSQUEDA_TIQUETES = 50;

const MOTIVO_TIQUETE_NO_ENCONTRADO = 'TIQUETE_NO_ENCONTRADO';
const MOTIVO_TIQUETE_YA_CANCELADO = 'TIQUETE_YA_CANCELADO';
const MOTIVO_ASIENTO_NO_ENCONTRADO = 'ASIENTO_NO_ENCONTRADO';
const MOTIVO_ASIENTO_NO_DISPONIBLE = 'ASIENTO_NO_DISPONIBLE';

function mapearTiqueteACamelCase(fila) {
  return {
    idTiquete: fila.id_tiquete,
    codigoReserva: fila.codigo_reserva,
    idVuelo: fila.id_vuelo,
    idPasajero: fila.id_pasajero,
    idAsiento: fila.id_asiento,
    idAgente: fila.id_agente,
    estado: fila.estado,
    precioPagado: Number(fila.precio_pagado),
  };
}

/**
 * Cancela un tiquete (cualquier estado activo -> 'CANCELADO'), liberando su
 * (vuelo, asiento) para una nueva reserva.
 *
 * @param {{ idTiquete: string, idAgente: string }} params
 * @returns {Promise<{ ok: true, tiquete: object, idVueloAfectado: string } | { ok: false, motivo: string }>}
 */
async function cancelarTiquete({ idTiquete, idAgente }) {
  return withTransaction(async (client) => {
    const tiqueteResult = await client.query(
      `SELECT id_tiquete, id_vuelo, estado
         FROM tiquetes
        WHERE id_tiquete = $1
        FOR UPDATE`,
      [idTiquete]
    );

    if (tiqueteResult.rowCount === 0) {
      return { ok: false, motivo: MOTIVO_TIQUETE_NO_ENCONTRADO };
    }

    const tiqueteActual = tiqueteResult.rows[0];

    if (tiqueteActual.estado === 'CANCELADO') {
      return { ok: false, motivo: MOTIVO_TIQUETE_YA_CANCELADO };
    }

    const actualizadoResult = await client.query(
      `UPDATE tiquetes
          SET estado = 'CANCELADO',
              fecha_expiracion = NULL,
              id_agente = $2
        WHERE id_tiquete = $1
        RETURNING id_tiquete, codigo_reserva, id_vuelo, id_pasajero, id_asiento, id_agente, estado, precio_pagado`,
      [idTiquete, idAgente]
    );

    return {
      ok: true,
      tiquete: mapearTiqueteACamelCase(actualizadoResult.rows[0]),
      idVueloAfectado: tiqueteActual.id_vuelo,
    };
  });
}

/**
 * Reagenda un tiquete a otro (vuelo, asiento) dentro de una única
 * transacción atómica, con bloqueo pesimista sobre el nuevo asiento físico
 * (mismo mecanismo que HU-02/SCRUM-6):
 *
 *   1. `SELECT ... FOR UPDATE` sobre el tiquete — serializa cualquier otra
 *      operación concurrente sobre ESTE tiquete (otra cancelación/
 *      reagendamiento al mismo tiempo).
 *   2. `SELECT ... FOR UPDATE OF a` sobre el NUEVO asiento — serializa
 *      cualquier intento concurrente de ocuparlo (bloqueo HU-02, compra, u
 *      otro reagendamiento).
 *   3. Verifica que no exista ya un tiquete activo de OTRO pasajero para el
 *      (nuevoVuelo, nuevoAsiento).
 *   4. `UPDATE` de la misma fila de tiquete (id_vuelo, id_asiento, estado).
 *      El índice único parcial `uq_tiquetes_vuelo_asiento_activo` es la red
 *      de seguridad final si, pese a los locks anteriores, dos
 *      transacciones llegaran a este UPDATE casi a la vez.
 *
 * @param {{ idTiquete: string, nuevoVueloId: string, nuevoAsientoId: string, idAgente: string }} params
 * @returns {Promise<
 *   { ok: true, tiquete: object, idVueloAnterior: string, idVueloNuevo: string } |
 *   { ok: false, motivo: string }
 * >}
 */
async function reagendarTiquete({ idTiquete, nuevoVueloId, nuevoAsientoId, idAgente }) {
  return withTransaction(async (client) => {
    const tiqueteResult = await client.query(
      `SELECT id_tiquete, id_vuelo, estado
         FROM tiquetes
        WHERE id_tiquete = $1
        FOR UPDATE`,
      [idTiquete]
    );

    if (tiqueteResult.rowCount === 0) {
      return { ok: false, motivo: MOTIVO_TIQUETE_NO_ENCONTRADO };
    }

    const tiqueteActual = tiqueteResult.rows[0];

    if (tiqueteActual.estado === 'CANCELADO') {
      return { ok: false, motivo: MOTIVO_TIQUETE_YA_CANCELADO };
    }

    const asientoResult = await client.query(
      `SELECT a.id_asiento, a.estado
         FROM asientos a
         JOIN vuelos v ON v.id_avion = a.id_avion
        WHERE a.id_asiento = $1
          AND v.id_vuelo = $2
        FOR UPDATE OF a`,
      [nuevoAsientoId, nuevoVueloId]
    );

    if (asientoResult.rowCount === 0) {
      return { ok: false, motivo: MOTIVO_ASIENTO_NO_ENCONTRADO };
    }

    if (asientoResult.rows[0].estado !== 'DISPONIBLE') {
      return { ok: false, motivo: MOTIVO_ASIENTO_NO_DISPONIBLE };
    }

    const activoResult = await client.query(
      `SELECT id_tiquete
         FROM tiquetes
        WHERE id_vuelo = $1
          AND id_asiento = $2
          AND estado <> 'CANCELADO'
          AND id_tiquete <> $3
        LIMIT 1`,
      [nuevoVueloId, nuevoAsientoId, idTiquete]
    );

    if (activoResult.rowCount > 0) {
      return { ok: false, motivo: MOTIVO_ASIENTO_NO_DISPONIBLE };
    }

    try {
      const actualizadoResult = await client.query(
        `UPDATE tiquetes
            SET id_vuelo = $2,
                id_asiento = $3,
                estado = 'REAGENDADO',
                fecha_expiracion = NULL,
                id_agente = $4
          WHERE id_tiquete = $1
          RETURNING id_tiquete, codigo_reserva, id_vuelo, id_pasajero, id_asiento, id_agente, estado, precio_pagado`,
        [idTiquete, nuevoVueloId, nuevoAsientoId, idAgente]
      );

      return {
        ok: true,
        tiquete: mapearTiqueteACamelCase(actualizadoResult.rows[0]),
        idVueloAnterior: tiqueteActual.id_vuelo,
        idVueloNuevo: nuevoVueloId,
      };
    } catch (error) {
      if (error.code === PG_UNIQUE_VIOLATION) {
        // Red de seguridad: uq_tiquetes_vuelo_asiento_activo impidió el
        // UPDATE pese a los locks anteriores (defensa en profundidad, mismo
        // patrón que el resto de repositorios transaccionales).
        return { ok: false, motivo: MOTIVO_ASIENTO_NO_DISPONIBLE };
      }
      throw error;
    }
  });
}

// Búsqueda de solo lectura: opera directo sobre `pool` (sin transacción ni
// locks), mismo patrón que `metricasAdminRepository.js`.
const QUERY_BUSCAR_TIQUETES = `
  SELECT
      t.id_tiquete,
      t.codigo_reserva,
      t.estado,
      t.precio_pagado,
      v.numero_vuelo,
      v.origen,
      v.destino,
      v.fecha_hora_salida,
      a.codigo_asiento,
      u.nombres,
      u.apellidos,
      u.documento_identidad,
      u.correo_electronico
    FROM tiquetes t
    JOIN vuelos v ON v.id_vuelo = t.id_vuelo
    JOIN asientos a ON a.id_asiento = t.id_asiento
    JOIN usuarios u ON u.id_usuario = t.id_pasajero
   WHERE ($1::text IS NULL OR t.codigo_reserva = $1)
     AND ($2::text IS NULL OR u.documento_identidad = $2)
   ORDER BY v.fecha_hora_salida DESC
   LIMIT $3
`;

function mapearTiqueteBusquedaACamelCase(fila) {
  return {
    idTiquete: fila.id_tiquete,
    codigoReserva: fila.codigo_reserva,
    estado: fila.estado,
    precioPagado: Number(fila.precio_pagado),
    numeroVuelo: fila.numero_vuelo,
    origen: fila.origen,
    destino: fila.destino,
    fechaHoraSalida: fila.fecha_hora_salida,
    codigoAsiento: fila.codigo_asiento,
    nombrePasajero: `${fila.nombres} ${fila.apellidos}`,
    documentoPasajero: fila.documento_identidad,
    correoPasajero: fila.correo_electronico,
  };
}

/**
 * Buscador básico de tiquetes para el agente/administrador (SCRUM-10): por
 * código de reserva (match exacto, es único) o por documento de identidad
 * del pasajero (puede traer varios tiquetes de la misma persona). El caso
 * de uso ya exige al menos uno de los dos antes de llamar esto.
 *
 * @param {{ codigoReserva?: string, documento?: string }} params
 * @returns {Promise<object[]>}
 */
async function buscarTiquetes({ codigoReserva, documento }) {
  const resultado = await pool.query(QUERY_BUSCAR_TIQUETES, [
    codigoReserva || null,
    documento || null,
    LIMITE_BUSQUEDA_TIQUETES,
  ]);

  return resultado.rows.map(mapearTiqueteBusquedaACamelCase);
}

module.exports = {
  cancelarTiquete,
  reagendarTiquete,
  buscarTiquetes,
  MOTIVO_TIQUETE_NO_ENCONTRADO,
  MOTIVO_TIQUETE_YA_CANCELADO,
  MOTIVO_ASIENTO_NO_ENCONTRADO,
  MOTIVO_ASIENTO_NO_DISPONIBLE,
};
