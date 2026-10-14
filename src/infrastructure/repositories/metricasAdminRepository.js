'use strict';

/**
 * Capa de Infraestructura — acceso a datos para las métricas del dashboard
 * administrativo (SCRUM-47). Solo lectura (agregaciones), así que opera
 * directo sobre `pool` sin transacción ni `FOR UPDATE` — mismo patrón que
 * `vuelosRepository.buscarVuelosDisponibles`/`asientosRepository.listarPorVuelo`.
 *
 * --------------------------------------------------------------------------
 * NOTA DE DISEÑO — qué cuenta como "asiento ocupado" por vuelo
 * --------------------------------------------------------------------------
 * Igual que en `asientosRepository.js`/`tiquetesRepository.js`: un asiento
 * está ocupado PARA UN VUELO si existe un tiquete activo (estado distinto
 * de 'CANCELADO') que referencie ese (vuelo, asiento) — nunca se usa
 * `asientos.estado`, que es administrativo/físico y compartido por todos
 * los vuelos de la misma aeronave. Para esta métrica de ocupación se cuenta
 * CUALQUIER tiquete activo (PENDIENTE, CONFIRMADO o REAGENDADO), no solo
 * CONFIRMADO: un asiento bloqueado temporalmente (HU-02) tampoco está
 * disponible para una nueva venta, así que debe contar como ocupado en el
 * panel del agente/administrador.
 */

const { pool } = require('../../config/database');

const CANTIDAD_PROXIMOS_VUELOS = 10;

// Se listan explícitamente (no solo los que `GROUP BY` devuelva) para que
// la respuesta siempre traiga las 4 claves con 0 cuando un estado no tiene
// tiquetes todavía, en vez de que el frontend tenga que manejar claves
// ausentes.
const ESTADOS_TIQUETE = ['PENDIENTE', 'CONFIRMADO', 'CANCELADO', 'REAGENDADO'];

const QUERY_INGRESOS_TOTALES = `
  SELECT COALESCE(SUM(precio_pagado), 0) AS ingresos_totales
    FROM tiquetes
   WHERE estado = 'CONFIRMADO'
`;

const QUERY_TIQUETES_POR_ESTADO = `
  SELECT estado, COUNT(*) AS cantidad
    FROM tiquetes
   GROUP BY estado
`;

// FILTER (WHERE ...) en vez de un JOIN ya filtrado: así un vuelo sin
// ningún tiquete activo sigue apareciendo (LEFT JOIN) con 0 ocupados, en
// vez de desaparecer de la lista.
const QUERY_PROXIMOS_VUELOS_OCUPACION = `
  SELECT
      v.id_vuelo,
      v.numero_vuelo,
      v.origen,
      v.destino,
      v.fecha_hora_salida,
      av.capacidad_total,
      COUNT(t.id_tiquete) FILTER (WHERE t.estado <> 'CANCELADO') AS asientos_ocupados
    FROM vuelos v
    JOIN aviones av ON av.id_avion = v.id_avion
    LEFT JOIN tiquetes t ON t.id_vuelo = v.id_vuelo
   WHERE v.fecha_hora_salida > now()
   GROUP BY v.id_vuelo, v.numero_vuelo, v.origen, v.destino, v.fecha_hora_salida, av.capacidad_total
   ORDER BY v.fecha_hora_salida ASC
   LIMIT $1
`;

function mapearTiquetesPorEstado(filas) {
  const conteo = Object.fromEntries(ESTADOS_TIQUETE.map((estado) => [estado, 0]));
  filas.forEach((fila) => {
    conteo[fila.estado] = Number(fila.cantidad);
  });
  return conteo;
}

function mapearProximoVuelo(fila) {
  const capacidadTotal = fila.capacidad_total;
  const asientosOcupados = Number(fila.asientos_ocupados);

  return {
    idVuelo: fila.id_vuelo,
    numeroVuelo: fila.numero_vuelo,
    origen: fila.origen,
    destino: fila.destino,
    fechaHoraSalida: fila.fecha_hora_salida,
    capacidadTotal,
    asientosOcupados,
    // `capacidadTotal` nunca es 0: ck_aviones_capacidad_positiva en
    // database/init.sql garantiza capacidad_total > 0 para todo avión.
    porcentajeOcupacion: Math.round((asientosOcupados / capacidadTotal) * 100),
  };
}

/**
 * @returns {Promise<{
 *   ingresosTotales: number,
 *   tiquetesPorEstado: Record<'PENDIENTE' | 'CONFIRMADO' | 'CANCELADO' | 'REAGENDADO', number>,
 *   proximosVuelos: object[],
 * }>}
 */
async function obtenerMetricas() {
  // Las 3 consultas son independientes entre sí (ninguna depende del
  // resultado de otra) y todas de solo lectura: se disparan en paralelo en
  // vez de en serie para no sumar sus latencias una tras otra.
  const [ingresosResult, estadosResult, proximosVuelosResult] = await Promise.all([
    pool.query(QUERY_INGRESOS_TOTALES),
    pool.query(QUERY_TIQUETES_POR_ESTADO),
    pool.query(QUERY_PROXIMOS_VUELOS_OCUPACION, [CANTIDAD_PROXIMOS_VUELOS]),
  ]);

  return {
    ingresosTotales: Number(ingresosResult.rows[0].ingresos_totales),
    tiquetesPorEstado: mapearTiquetesPorEstado(estadosResult.rows),
    proximosVuelos: proximosVuelosResult.rows.map(mapearProximoVuelo),
  };
}

module.exports = { obtenerMetricas };
