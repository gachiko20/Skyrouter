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

const PG_UNIQUE_VIOLATION = '23505';

const MOTIVO_USUARIO_NO_ENCONTRADO = 'USUARIO_NO_ENCONTRADO';
const MOTIVO_CORREO_YA_REGISTRADO = 'CORREO_YA_REGISTRADO';

function mapearUsuarioACamelCase(fila) {
  return {
    idUsuario: fila.id_usuario,
    nombreCompleto: `${fila.nombres} ${fila.apellidos}`,
    correo: fila.correo_electronico,
    telefono: fila.telefono,
    rol: fila.rol,
  };
}

/**
 * @param {string} usuarioId
 * @returns {Promise<{ ok: true, usuario: object } | { ok: false, motivo: string }>}
 */
async function obtenerUsuarioPorId(usuarioId) {
  const resultado = await pool.query(
    'SELECT id_usuario, nombres, apellidos, correo_electronico, telefono, rol FROM usuarios WHERE id_usuario = $1',
    [usuarioId]
  );

  if (resultado.rowCount === 0) {
    return { ok: false, motivo: MOTIVO_USUARIO_NO_ENCONTRADO };
  }

  return { ok: true, usuario: mapearUsuarioACamelCase(resultado.rows[0]) };
}

/**
 * Lee el hash de contraseña vigente. Nunca se expone fuera del caso de uso
 * de cambio de contraseña (a diferencia de `obtenerUsuarioPorId`, que es
 * seguro de devolver tal cual al controlador).
 *
 * @param {string} usuarioId
 * @returns {Promise<{ ok: true, hashContrasena: string } | { ok: false, motivo: string }>}
 */
async function obtenerHashContrasenaPorId(usuarioId) {
  const resultado = await pool.query('SELECT hash_contrasena FROM usuarios WHERE id_usuario = $1', [
    usuarioId,
  ]);

  if (resultado.rowCount === 0) {
    return { ok: false, motivo: MOTIVO_USUARIO_NO_ENCONTRADO };
  }

  return { ok: true, hashContrasena: resultado.rows[0].hash_contrasena };
}

/**
 * @param {string} usuarioId
 * @param {string} nuevoHash  Hash ya calculado (bcrypt); este repositorio no
 *   conoce el algoritmo de hashing, solo persiste el resultado.
 * @returns {Promise<void>}
 */
async function actualizarHashContrasena(usuarioId, nuevoHash) {
  await pool.query('UPDATE usuarios SET hash_contrasena = $2 WHERE id_usuario = $1', [
    usuarioId,
    nuevoHash,
  ]);
}

/**
 * Lee un usuario por correo CON su hash de contraseña (SCRUM-49: login).
 * Igual que `obtenerHashContrasenaPorId`, el hash nunca debe salir de este
 * flujo interno — `loginUsuarioUseCase` lo usa solo para `bcrypt.compare` y
 * jamás lo incluye en la respuesta HTTP.
 *
 * @param {string} correo
 * @returns {Promise<{ ok: true, usuario: object } | { ok: false, motivo: string }>}
 */
async function obtenerUsuarioPorCorreoConHash(correo) {
  const resultado = await pool.query(
    `SELECT id_usuario, nombres, apellidos, correo_electronico, rol, hash_contrasena
       FROM usuarios
      WHERE correo_electronico = $1`,
    [correo]
  );

  if (resultado.rowCount === 0) {
    return { ok: false, motivo: MOTIVO_USUARIO_NO_ENCONTRADO };
  }

  const fila = resultado.rows[0];
  return {
    ok: true,
    usuario: {
      idUsuario: fila.id_usuario,
      nombreCompleto: `${fila.nombres} ${fila.apellidos}`,
      correo: fila.correo_electronico,
      rol: fila.rol,
      hashContrasena: fila.hash_contrasena,
    },
  };
}

/**
 * Crea un usuario nuevo (SCRUM-49: registro). El caso de uso ya valida que
 * el correo no exista antes de llamar esto; el `catch` de abajo es una red
 * de seguridad adicional (no la única validación) para la condición de
 * carrera entre dos registros simultáneos con el mismo correo, que esa
 * verificación previa no puede descartar por sí sola — el mismo patrón de
 * defensa en profundidad que `asientosRepository.bloquearAsientoTemporal`
 * usa para `uq_tiquetes_codigo_reserva`.
 *
 * @param {{ nombres: string, apellidos: string, correo: string, hashContrasena: string, telefono?: string, documentoIdentidad?: string, rol: string }} datos
 * @returns {Promise<{ ok: true, usuario: object } | { ok: false, motivo: string }>}
 */
async function crearUsuario({ nombres, apellidos, correo, hashContrasena, telefono, documentoIdentidad, rol }) {
  try {
    const resultado = await pool.query(
      `INSERT INTO usuarios (nombres, apellidos, correo_electronico, hash_contrasena, telefono, documento_identidad, rol)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id_usuario, nombres, apellidos, correo_electronico, telefono, rol`,
      [nombres, apellidos, correo, hashContrasena, telefono || null, documentoIdentidad || null, rol]
    );

    return { ok: true, usuario: mapearUsuarioACamelCase(resultado.rows[0]) };
  } catch (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      return { ok: false, motivo: MOTIVO_CORREO_YA_REGISTRADO };
    }
    throw error;
  }
}

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

module.exports = {
  obtenerHistorialVuelos,
  obtenerUsuarioPorId,
  obtenerHashContrasenaPorId,
  actualizarHashContrasena,
  obtenerUsuarioPorCorreoConHash,
  crearUsuario,
  MOTIVO_USUARIO_NO_ENCONTRADO,
  MOTIVO_CORREO_YA_REGISTRADO,
};
