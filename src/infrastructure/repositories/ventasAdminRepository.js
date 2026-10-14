'use strict';

/**
 * Capa de Infraestructura — acceso a datos para la venta de tiquetes en
 * mostrador por un agente comercial o administrador.
 *
 * Mismo patrón de concurrencia que `tiquetesRepository.confirmarCompra`
 * (checkout de pasajeros): bloqueo pesimista `FOR UPDATE` sobre la fila
 * física del asiento + verificación de tiquetes activos del vuelo, todo en
 * una única transacción; el índice único parcial
 * `uq_tiquetes_vuelo_asiento_activo` queda como red de seguridad.
 *
 * Diferencias con el checkout:
 *   - El pasajero NO es quien hace la petición: se busca por documento (o
 *     correo) y, si no existe, se crea como usuario `pasajero` básico.
 *   - El tiquete registra `id_agente` (auditoría de quién vendió).
 *   - El bloqueo temporal (PENDIENTE) que el plano de cabina crea al
 *     seleccionar el asiento queda a nombre del AGENTE (es quien tiene la
 *     sesión); ese bloqueo propio se convierte aquí en el tiquete
 *     CONFIRMADO del pasajero, en vez de tratarse como conflicto.
 */

const { withTransaction } = require('../../config/database');

const PG_UNIQUE_VIOLATION = '23505';
const MAX_INTENTOS_CODIGO_RESERVA = 3;

const MOTIVO_ASIENTO_NO_ENCONTRADO = 'ASIENTO_NO_ENCONTRADO';
const MOTIVO_ASIENTO_NO_DISPONIBLE = 'ASIENTO_NO_DISPONIBLE';
const MOTIVO_VUELO_NO_VENDIBLE = 'VUELO_NO_VENDIBLE';
const MOTIVO_CORREO_DE_OTRO_PASAJERO = 'CORREO_DE_OTRO_PASAJERO';

const COLUMNAS_TIQUETE =
  'id_tiquete, codigo_reserva, id_vuelo, id_pasajero, id_asiento, id_agente, estado, precio_pagado, fecha_reserva';

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
    idAgente: fila.id_agente,
    estado: fila.estado,
    precioPagado: Number(fila.precio_pagado),
    fechaReserva: fila.fecha_reserva,
  };
}

/**
 * Busca al pasajero por documento; si no existe, por correo; si tampoco,
 * lo crea como `pasajero` básico. Corre dentro de la transacción de la
 * venta (mismo `client`).
 *
 * @returns {Promise<{ ok: true, idPasajero: string, creado: boolean } | { ok: false, motivo: string }>}
 */
async function resolverPasajero(client, pasajero, hashContrasenaProvisional) {
  const porDocumento = await client.query(
    'SELECT id_usuario FROM usuarios WHERE upper(documento_identidad) = $1',
    [pasajero.documento]
  );
  if (porDocumento.rowCount > 0) {
    return { ok: true, idPasajero: porDocumento.rows[0].id_usuario, creado: false };
  }

  const porCorreo = await client.query(
    'SELECT id_usuario, documento_identidad FROM usuarios WHERE lower(correo_electronico) = lower($1)',
    [pasajero.correo]
  );
  if (porCorreo.rowCount > 0) {
    const existente = porCorreo.rows[0];
    // El correo ya es de un usuario con OTRO documento: no se puede saber
    // cuál de los dos es el dato correcto, así que se rechaza.
    if (existente.documento_identidad) {
      return { ok: false, motivo: MOTIVO_CORREO_DE_OTRO_PASAJERO };
    }
    // Usuario registrado por la web sin documento: se completa con el del mostrador.
    await client.query('UPDATE usuarios SET documento_identidad = $2 WHERE id_usuario = $1', [
      existente.id_usuario,
      pasajero.documento,
    ]);
    return { ok: true, idPasajero: existente.id_usuario, creado: false };
  }

  // ON CONFLICT DO NOTHING: si otra venta concurrente creó al mismo
  // pasajero un instante antes, no se aborta la transacción; se relee.
  const insertado = await client.query(
    `INSERT INTO usuarios (nombres, apellidos, correo_electronico, hash_contrasena, telefono, documento_identidad, rol)
     VALUES ($1, $2, $3, $4, $5, $6, 'pasajero')
     ON CONFLICT DO NOTHING
     RETURNING id_usuario`,
    [
      pasajero.nombres,
      pasajero.apellidos,
      pasajero.correo,
      hashContrasenaProvisional,
      pasajero.telefono || null,
      pasajero.documento,
    ]
  );
  if (insertado.rowCount > 0) {
    return { ok: true, idPasajero: insertado.rows[0].id_usuario, creado: true };
  }

  // Carrera con otra venta que creó al mismo pasajero entre el SELECT y el
  // INSERT: se relee. Nada se escribió en esta rama, así que el rechazo
  // final (el conflicto fue por el correo, con otro documento) es seguro.
  const releido = await client.query('SELECT id_usuario FROM usuarios WHERE upper(documento_identidad) = $1', [
    pasajero.documento,
  ]);
  if (releido.rowCount > 0) {
    return { ok: true, idPasajero: releido.rows[0].id_usuario, creado: false };
  }
  return { ok: false, motivo: MOTIVO_CORREO_DE_OTRO_PASAJERO };
}

/**
 * Registra la venta en mostrador de `asientoId` en `vueloId` para el
 * pasajero indicado, como tiquete CONFIRMADO con `id_agente = idAgente`.
 *
 * @param {{
 *   vueloId: string,
 *   asientoId: string,
 *   pasajero: { documento: string, nombres: string, apellidos: string, correo: string, telefono?: string },
 *   idAgente: string,
 *   hashContrasenaProvisional: string,
 * }} params
 * @returns {Promise<{ ok: true, tiquete: object, pasajeroCreado: boolean } | { ok: false, motivo: string }>}
 */
async function registrarVentaMostrador({ vueloId, asientoId, pasajero, idAgente, hashContrasenaProvisional }) {
  return withTransaction(async (client) => {
    // 1. Bloqueo pesimista de la fila física del asiento (serializa ventas,
    //    checkouts y bloqueos temporales concurrentes sobre ese asiento).
    const asientoResult = await client.query(
      `SELECT a.id_asiento, a.estado, v.precio_base, v.estado AS estado_vuelo,
              v.fecha_hora_salida > now() AS es_futuro
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

    if (!asiento.es_futuro || asiento.estado_vuelo === 'CANCELADO') {
      return { ok: false, motivo: MOTIVO_VUELO_NO_VENDIBLE };
    }

    if (asiento.estado !== 'DISPONIBLE') {
      return { ok: false, motivo: MOTIVO_ASIENTO_NO_DISPONIBLE };
    }

    // 2. Tiquete activo de ese asiento en ese vuelo, si lo hay. Se valida
    //    ANTES de crear al pasajero: `withTransaction` hace COMMIT también
    //    cuando se devuelve `{ ok: false }`, así que una venta rechazada no
    //    debe haber escrito nada todavía.
    const activoResult = await client.query(
      `SELECT id_tiquete, id_pasajero, estado
         FROM tiquetes
        WHERE id_vuelo = $1
          AND id_asiento = $2
          AND estado <> 'CANCELADO'
        LIMIT 1`,
      [vueloId, asientoId]
    );

    const activo = activoResult.rows[0];
    // Único tiquete activo aceptable: el bloqueo temporal que el propio
    // agente hizo desde el plano de cabina; se convierte en la venta.
    if (activo && !(activo.estado === 'PENDIENTE' && activo.id_pasajero === idAgente)) {
      return { ok: false, motivo: MOTIVO_ASIENTO_NO_DISPONIBLE };
    }

    // 3. Pasajero (existente o nuevo). El único rechazo posible ocurre
    //    antes de cualquier escritura (ver `resolverPasajero`).
    const resolucion = await resolverPasajero(client, pasajero, hashContrasenaProvisional);
    if (!resolucion.ok) {
      return resolucion;
    }
    const { idPasajero } = resolucion;

    if (activo) {
      const confirmado = await client.query(
        `UPDATE tiquetes
            SET id_pasajero = $2, id_agente = $3, estado = 'CONFIRMADO', fecha_expiracion = NULL
          WHERE id_tiquete = $1
          RETURNING ${COLUMNAS_TIQUETE}`,
        [activo.id_tiquete, idPasajero, idAgente]
      );

      return {
        ok: true,
        tiquete: mapearTiqueteACamelCase(confirmado.rows[0]),
        pasajeroCreado: resolucion.creado,
      };
    }

    // 4. Sin bloqueo previo: tiquete nuevo ya CONFIRMADO.
    for (let intento = 1; intento <= MAX_INTENTOS_CODIGO_RESERVA; intento += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const insertado = await client.query(
          `INSERT INTO tiquetes (codigo_reserva, id_vuelo, id_pasajero, id_asiento, id_agente, estado, precio_pagado)
           VALUES ($1, $2, $3, $4, $5, 'CONFIRMADO', $6)
           RETURNING ${COLUMNAS_TIQUETE}`,
          [generarCodigoReserva(), vueloId, idPasajero, asientoId, idAgente, asiento.precio_base]
        );

        return {
          ok: true,
          tiquete: mapearTiqueteACamelCase(insertado.rows[0]),
          pasajeroCreado: resolucion.creado,
        };
      } catch (error) {
        const esColisionCodigoReserva =
          error.code === PG_UNIQUE_VIOLATION && error.constraint === 'uq_tiquetes_codigo_reserva';

        if (esColisionCodigoReserva && intento < MAX_INTENTOS_CODIGO_RESERVA) {
          continue; // Código de reserva duplicado: reintentar con uno nuevo.
        }

        // Cualquier otra violación de unicidad (índice anti-overbooking)
        // aborta la transacción: se relanza para que haga ROLLBACK y el
        // errorHandler la traduzca a 409.
        throw error;
      }
    }

    return { ok: false, motivo: MOTIVO_ASIENTO_NO_DISPONIBLE };
  });
}

module.exports = {
  registrarVentaMostrador,
  MOTIVO_ASIENTO_NO_ENCONTRADO,
  MOTIVO_ASIENTO_NO_DISPONIBLE,
  MOTIVO_VUELO_NO_VENDIBLE,
  MOTIVO_CORREO_DE_OTRO_PASAJERO,
};
