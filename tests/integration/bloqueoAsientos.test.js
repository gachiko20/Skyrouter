'use strict';

/**
 * Prueba de integración — bloqueo temporal de asientos (HU-02, SCRUM-8).
 *
 * Usa Supertest contra la app de Express en memoria (sin necesidad de un
 * servidor levantado aparte) y Jest como runner. Requiere PostgreSQL
 * accesible con el esquema de `database/init.sql` ya aplicado (mismo
 * requisito que `tests/stress/concurrencyTest.js`).
 *
 * Escenario: dos usuarios distintos intentan bloquear EL MISMO asiento en
 * EL MISMO vuelo con dos peticiones POST simultáneas (Promise.all). Se
 * afirma que exactamente una recibe 200 OK y la otra 409 Conflict, y que en
 * PostgreSQL solo quedó UN tiquete activo — la prueba real de 0%
 * overbooking es el estado en base de datos, no solo el código HTTP.
 *
 * Uso:
 *   npm run test:integration
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const { pool } = require('../../src/config/database');

const ENDPOINT = '/api/asientos/bloquear';

// SCRUM-49: el endpoint ahora exige `requireAuth` y el controlador toma
// `usuarioId` de `req.user.idUsuario` (el JWT), no del body — por eso cada
// request necesita su propio token firmado con el usuario que se espera
// que quede como dueño del tiquete.
function generarToken(idUsuario) {
  return jwt.sign({ idUsuario, rol: 'pasajero' }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function sembrarVueloConUnAsiento() {
  const avionResult = await pool.query(
    `INSERT INTO aviones (matricula, modelo, fabricante, capacidad_total)
     VALUES ('IT-' || substr(gen_random_uuid()::text, 1, 8), 'A320', 'Airbus', 180)
     RETURNING id_avion`
  );
  const idAvion = avionResult.rows[0].id_avion;

  const vueloResult = await pool.query(
    `INSERT INTO vuelos (numero_vuelo, id_avion, origen, destino, fecha_hora_salida, fecha_hora_llegada, precio_base)
     VALUES ('IT' || floor(random() * 9000 + 1000)::text, $1, 'BOG', 'MDE',
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

  const sufijo = `${Date.now()}.${Math.floor(Math.random() * 1000)}`;
  const usuarioAResult = await pool.query(
    `INSERT INTO usuarios (nombres, apellidos, correo_electronico, hash_contrasena)
     VALUES ('Usuario', 'A', $1, 'hash-no-valido-solo-test')
     RETURNING id_usuario`,
    [`integration.test.${sufijo}.a@skyrouter.test`]
  );
  const usuarioBResult = await pool.query(
    `INSERT INTO usuarios (nombres, apellidos, correo_electronico, hash_contrasena)
     VALUES ('Usuario', 'B', $1, 'hash-no-valido-solo-test')
     RETURNING id_usuario`,
    [`integration.test.${sufijo}.b@skyrouter.test`]
  );

  return {
    idAvion,
    idVuelo,
    idAsiento,
    idUsuarioA: usuarioAResult.rows[0].id_usuario,
    idUsuarioB: usuarioBResult.rows[0].id_usuario,
  };
}

async function limpiarDatosDePrueba({ idAvion, idVuelo }) {
  await pool.query('DELETE FROM tiquetes WHERE id_vuelo = $1', [idVuelo]);
  await pool.query('DELETE FROM vuelos WHERE id_vuelo = $1', [idVuelo]);
  await pool.query('DELETE FROM aviones WHERE id_avion = $1', [idAvion]); // cascada a asientos
}

describe('POST /api/asientos/bloquear — concurrencia (HU-02, SCRUM-8)', () => {
  let datos;

  beforeEach(async () => {
    datos = await sembrarVueloConUnAsiento();
  });

  afterEach(async () => {
    await limpiarDatosDePrueba(datos);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('responde 200 OK a un único bloqueo válido y crea un tiquete PENDIENTE', async () => {
    const { idVuelo, idAsiento, idUsuarioA } = datos;

    const respuesta = await request(app)
      .post(ENDPOINT)
      .set('Authorization', `Bearer ${generarToken(idUsuarioA)}`)
      .send({ vueloId: idVuelo, asientoId: idAsiento });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.tiquete).toMatchObject({
      idVuelo,
      idAsiento,
      idPasajero: idUsuarioA,
      estado: 'PENDIENTE',
    });
  });

  it('ante dos peticiones simultáneas sobre el mismo asiento, una recibe 200 y la otra 409 (0% overbooking)', async () => {
    const { idVuelo, idAsiento, idUsuarioA, idUsuarioB } = datos;

    const [respuestaA, respuestaB] = await Promise.all([
      request(app)
        .post(ENDPOINT)
        .set('Authorization', `Bearer ${generarToken(idUsuarioA)}`)
        .send({ vueloId: idVuelo, asientoId: idAsiento }),
      request(app)
        .post(ENDPOINT)
        .set('Authorization', `Bearer ${generarToken(idUsuarioB)}`)
        .send({ vueloId: idVuelo, asientoId: idAsiento }),
    ]);

    const codigos = [respuestaA.status, respuestaB.status].sort();
    expect(codigos).toEqual([200, 409]);

    const respuestaConflicto = respuestaA.status === 409 ? respuestaA : respuestaB;
    expect(respuestaConflicto.body).toMatchObject({
      status: 'error',
      code: 409,
      errorCode: 'ASIENTO_NO_DISPONIBLE',
    });

    // La fuente de verdad es la base de datos, no solo el código HTTP.
    const { rows: tiquetesActivos } = await pool.query(
      `SELECT id_tiquete FROM tiquetes WHERE id_vuelo = $1 AND id_asiento = $2 AND estado <> 'CANCELADO'`,
      [idVuelo, idAsiento]
    );
    expect(tiquetesActivos).toHaveLength(1);
  });
});
