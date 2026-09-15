'use strict';

/**
 * Pool de conexiones PostgreSQL + helper transaccional.
 *
 * `withTransaction` centraliza el ciclo BEGIN/COMMIT/ROLLBACK/release para
 * que ningún caller (controladores, servicios) tenga que repetirlo ni
 * pueda olvidar liberar el cliente del pool.
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'skyrouter',
  password: process.env.DB_PASSWORD || 'skyrouter',
  database: process.env.DB_NAME || 'skyrouter',
  max: Number(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Un cliente inactivo del pool puede emitir errores async (p. ej. conexión
// caída por el servidor). Sin este listener, Node trata ese evento como una
// excepción no capturada y tumba el proceso.
pool.on('error', (err) => {
  console.error('[db] Error inesperado en un cliente inactivo del pool:', err);
});

/**
 * Ejecuta `callback(client)` dentro de una transacción con COMMIT/ROLLBACK
 * automático. El caller debe usar `client`, no `pool`, para todas las
 * queries que deban participar en la transacción (incluyendo los
 * `SELECT ... FOR UPDATE`, cuyo bloqueo solo tiene efecto dentro de la
 * misma conexión/transacción que lo adquirió).
 *
 * @param {(client: import('pg').PoolClient) => Promise<T>} callback
 * @returns {Promise<T>}
 * @template T
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // No hay mucho más que hacer si el propio ROLLBACK falla (p. ej. la
      // conexión se cayó); se registra y se propaga el error original.
      console.error('[db] Fallo al ejecutar ROLLBACK:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, withTransaction };
