'use strict';

/**
 * Script formal de seeding de usuarios de prueba con rol elevado
 * (agente_comercial / administrador).
 *
 * --------------------------------------------------------------------------
 * POR QUÉ EXISTE ESTE ARCHIVO
 * --------------------------------------------------------------------------
 * Hasta ahora estas cuentas se creaban a mano con `INSERT` sueltos por
 * `docker exec psql` en cada sesión de pruebas manuales, y eso ya causó dos
 * problemas reales:
 *   1. Contraseñas que nadie recordaba de una sesión a otra.
 *   2. Un 500 real en producción local: un agente de prueba se BORRÓ al
 *      limpiar después de un ticket, pero su JWT (vigente 2h) seguía
 *      "siendo válido" y al usarlo para cancelar un tiquete, la fila quedó
 *      apuntando a un `id_agente` que ya no existía en `usuarios`
 *      (violación de `fk_tiquetes_agente`).
 *
 * Este script resuelve ambos de raíz usando UPSERT
 * (`ON CONFLICT (correo_electronico) DO UPDATE`) en vez de borrar y
 * recrear: si el usuario ya existe, se le resetea la contraseña/rol a los
 * valores conocidos de abajo SIN cambiar su `id_usuario`. Eso significa que
 * cualquier tiquete/token que ya referencie a ese usuario sigue siendo
 * válido después de re-sembrar — el problema de la llave foránea
 * simplemente no puede volver a pasar con este flujo.
 *
 * Idempotente: se puede correr tantas veces como se quiera.
 *
 * Uso:
 *   npm run seed:users
 */

const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/database');

const SALT_ROUNDS = 10;

const USUARIOS_DE_PRUEBA = [
  {
    nombres: 'Agente',
    apellidos: 'De Prueba',
    correo: 'agente.prueba@skyrouter.test',
    password: 'Agente123',
    rol: 'agente_comercial',
  },
  {
    nombres: 'Admin',
    apellidos: 'De Prueba',
    correo: 'admin.prueba@skyrouter.test',
    password: 'Admin123',
    rol: 'administrador',
  },
];

async function sembrarUsuario({ nombres, apellidos, correo, password, rol }) {
  const hashContrasena = await bcrypt.hash(password, SALT_ROUNDS);

  await pool.query(
    `INSERT INTO usuarios (nombres, apellidos, correo_electronico, hash_contrasena, rol)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (correo_electronico)
     DO UPDATE SET
       hash_contrasena = EXCLUDED.hash_contrasena,
       rol = EXCLUDED.rol,
       nombres = EXCLUDED.nombres,
       apellidos = EXCLUDED.apellidos`,
    [nombres, apellidos, correo, hashContrasena, rol]
  );

  console.log(`  ✓ ${correo.padEnd(32)} rol=${rol.padEnd(17)} password=${password}`);
}

async function main() {
  console.log('[seed:users] Sembrando usuarios de prueba (UPSERT, idempotente)...\n');

  for (const usuario of USUARIOS_DE_PRUEBA) {
    // eslint-disable-next-line no-await-in-loop
    await sembrarUsuario(usuario);
  }

  console.log('\n[seed:users] Listo.');
  await pool.end();
}

main().catch((error) => {
  console.error('[seed:users] Error sembrando usuarios:', error);
  pool.end().finally(() => process.exit(1));
});
