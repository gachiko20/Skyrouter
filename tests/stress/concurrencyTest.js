'use strict';

/**
 * Prueba de estrés / integración para la capa de concurrencia de reserva
 * de asientos (SCRUM-6).
 *
 * Requiere que el servidor Express (src/server.js) y PostgreSQL estén
 * corriendo y accesibles. El script siembra sus propios datos de prueba
 * (un avión, un vuelo, UN asiento y 20 usuarios) directamente contra la
 * base de datos, dispara 20 solicitudes HTTP de reserva simultáneas contra
 * ESE MISMO asiento/vuelo con 20 usuarios distintos, y verifica:
 *
 *   1) Exactamente 1 respuesta HTTP 200 OK.
 *   2) Exactamente 19 respuestas HTTP 409 Conflict.
 *   3) Exactamente 1 tiquete activo en PostgreSQL para ese asiento/vuelo
 *      (0% overbooking, verificado directamente en la fuente de verdad).
 *
 * Uso:
 *   npm run test:stress
 *   BASE_URL=http://localhost:3000 node tests/stress/concurrencyTest.js
 */

const axios = require('axios');
const { pool } = require('../../src/config/database');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CONCURRENCIA = 20;

/** Crea avión + vuelo + 1 asiento + 20 usuarios de prueba, aislados por UUID/sufijo aleatorio. */
async function seedDatosDePrueba() {
  const avionResult = await pool.query(
    `INSERT INTO aviones (matricula, modelo, fabricante, capacidad_total)
     VALUES ('TS-' || substr(gen_random_uuid()::text, 1, 8), 'A320', 'Airbus', 180)
     RETURNING id_avion`
  );
  const idAvion = avionResult.rows[0].id_avion;

  const vueloResult = await pool.query(
    `INSERT INTO vuelos (numero_vuelo, id_avion, origen, destino, fecha_hora_salida, fecha_hora_llegada, precio_base)
     VALUES ('TS' || floor(random() * 9000 + 1000)::text, $1, 'BOG', 'MDE',
             now() + interval '1 day', now() + interval '1 day 1 hour', 250000)
     RETURNING id_vuelo`,
    [idAvion]
  );
  const idVuelo = vueloResult.rows[0].id_vuelo;

  const asientoResult = await pool.query(
    `INSERT INTO asientos (id_avion, codigo_asiento, clase, estado)
     VALUES ($1, '1A', 'ECONOMICA', 'DISPONIBLE')
     RETURNING id_asiento`,
    [idAvion]
  );
  const idAsiento = asientoResult.rows[0].id_asiento;

  const idsUsuarios = [];
  const sufijo = Date.now();
  for (let i = 0; i < CONCURRENCIA; i += 1) {
    const usuarioResult = await pool.query(
      `INSERT INTO usuarios (nombres, apellidos, correo_electronico, hash_contrasena)
       VALUES ($1, 'Prueba', $2, 'hash-no-valido-solo-test')
       RETURNING id_usuario`,
      [`Usuario${i}`, `stress.test.${sufijo}.${i}@skyrouter.test`]
    );
    idsUsuarios.push(usuarioResult.rows[0].id_usuario);
  }

  return { idAvion, idVuelo, idAsiento, idsUsuarios };
}

/** Dispara CONCURRENCIA peticiones POST simultáneas contra el mismo asiento/vuelo. */
async function dispararReservasConcurrentes(idVuelo, idAsiento, idsUsuarios) {
  const peticiones = idsUsuarios.map((idUsuario) =>
    axios.post(
      `${BASE_URL}/api/vuelos/${idVuelo}/asientos/${idAsiento}/bloqueo`,
      { usuarioId: idUsuario },
      { validateStatus: () => true } // No lanzar en 4xx/5xx: se inspeccionan todos los códigos.
    )
  );
  return Promise.all(peticiones);
}

/** Consulta la fuente de verdad: tiquetes activos (no cancelados) para ese vuelo/asiento. */
async function verificarEstadoFinalEnBD(idVuelo, idAsiento) {
  const result = await pool.query(
    `SELECT id_tiquete, id_pasajero, estado
       FROM tiquetes
      WHERE id_vuelo = $1 AND id_asiento = $2 AND estado <> 'CANCELADO'`,
    [idVuelo, idAsiento]
  );
  return result.rows;
}

async function main() {
  console.log(`\n=== Prueba de concurrencia: ${CONCURRENCIA} solicitudes simultáneas sobre el mismo asiento ===\n`);

  console.log('[1/4] Sembrando datos de prueba (avión, vuelo, asiento, usuarios)...');
  const { idVuelo, idAsiento, idsUsuarios } = await seedDatosDePrueba();
  console.log(`      vuelo=${idVuelo}`);
  console.log(`      asiento=${idAsiento}`);

  console.log(`\n[2/4] Disparando ${CONCURRENCIA} peticiones POST simultáneas (Promise.all)...`);
  const respuestas = await dispararReservasConcurrentes(idVuelo, idAsiento, idsUsuarios);

  const exitosas = respuestas.filter((r) => r.status === 200);
  const conflictos = respuestas.filter((r) => r.status === 409);
  const otras = respuestas.filter((r) => r.status !== 200 && r.status !== 409);

  console.log('\n[3/4] Resultados HTTP:');
  console.log(`      200 OK       -> ${exitosas.length}`);
  console.log(`      409 Conflict -> ${conflictos.length}`);
  if (otras.length > 0) {
    console.log(`      Otros codigos -> ${otras.length} (${otras.map((r) => r.status).join(', ')})`);
    otras.forEach((r) => console.log('        detalle:', r.data));
  }

  console.log('\n[4/4] Verificando estado final en PostgreSQL...');
  const tiquetesActivos = await verificarEstadoFinalEnBD(idVuelo, idAsiento);
  console.log(`      Tiquetes activos en BD para ese vuelo/asiento: ${tiquetesActivos.length}`);
  tiquetesActivos.forEach((t) =>
    console.log(`        -> id_tiquete=${t.id_tiquete} id_pasajero=${t.id_pasajero} estado=${t.estado}`)
  );

  const httpOk = exitosas.length === 1 && conflictos.length === CONCURRENCIA - 1;
  const bdOk = tiquetesActivos.length === 1;

  console.log('\n=== Veredicto ===');
  console.log(`HTTP (1x 200 OK + ${CONCURRENCIA - 1}x 409 Conflict): ${httpOk ? 'PASS' : 'FAIL'}`);
  console.log(`Consistencia en BD (exactamente 1 tiquete activo):     ${bdOk ? 'PASS' : 'FAIL'}`);
  console.log(
    httpOk && bdOk
      ? '\n✔ 0% OVERBOOKING CONFIRMADO\n'
      : '\n✘ FALLO: se detectó una inconsistencia / posible overbooking\n'
  );

  await pool.end();
  process.exitCode = httpOk && bdOk ? 0 : 1;
}

main().catch((error) => {
  console.error('Error ejecutando la prueba de estrés:', error);
  pool.end().finally(() => process.exit(1));
});
