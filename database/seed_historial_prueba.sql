-- =============================================================================
-- Sky Rout Operations — Datos de prueba: historial de vuelos del usuario dev
--
-- Script de SEEDING manual (no es una migración): inserta tiquetes de
-- prueba para el usuario de desarrollo (VITE_USUARIO_ID_DEV) sobre los
-- vuelos BOG->MDE ya sembrados, para poder probar de inmediato
-- GET /api/usuarios/:id/historial y la tabla "Mis Viajes" del frontend sin
-- tener que completar el flujo de checkout manualmente.
--
-- PRERREQUISITO: requiere que `database/seed_vuelos_prueba_bog_mde.sql` ya
-- se haya ejecutado (usuario, avión y vuelos de prueba). Si no, los INSERT
-- de abajo no encuentran filas que unir y no insertan nada (no fallan).
--
-- Idempotente: puede reejecutarse sin duplicar filas. Los `id_tiquete` son
-- fijos y el `ON CONFLICT ON CONSTRAINT uq_tiquetes_codigo_reserva` evita
-- reinsertar si el script ya corrió antes (mismo idioma que
-- `seed_vuelos_prueba_bog_mde.sql`). El `id_asiento` de cada tiquete se
-- resuelve por (id_avion, codigo_asiento) en vez de hardcodearse, porque
-- `asientos.id_asiento` se genera con `gen_random_uuid()` y cambia en cada
-- reseed del avión de prueba.
--
-- Asientos elegidos (3A, 3B, 3C — fila 3, económica) porque no chocan con
-- los que ya usan las pruebas manuales de HU-02/checkout sobre este mismo
-- avión de prueba (típicamente filas 1 y 2); aun si ya estuvieran
-- ocupados en tu base, el índice único parcial `uq_tiquetes_vuelo_asiento_
-- activo` haría fallar el INSERT con un error claro en vez de corromper
-- datos, así que es seguro reintentar con otro código de asiento libre.
--
-- Uso:
--   docker exec -i skyrouter-db psql -U skyrouter -d skyrouter < database/seed_historial_prueba.sql
--   # o, si tienes psql instalado localmente:
--   psql -h localhost -U skyrouter -d skyrouter -f database/seed_historial_prueba.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Tiquete CONFIRMADO — SKY100 (BOG -> MDE, mañana), asiento 3A
-- -----------------------------------------------------------------------------
INSERT INTO tiquetes (id_tiquete, codigo_reserva, id_vuelo, id_pasajero, id_asiento, estado, precio_pagado)
SELECT
    'd4000000-0000-0000-0000-000000000001',
    'PRUEB1',
    v.id_vuelo,
    'c3000000-0000-0000-0000-000000000001',
    a.id_asiento,
    'CONFIRMADO',
    v.precio_base
FROM vuelos v
JOIN asientos a ON a.id_avion = v.id_avion AND a.codigo_asiento = '3A'
WHERE v.id_vuelo = 'b2000000-0000-0000-0000-000000000001'
ON CONFLICT ON CONSTRAINT uq_tiquetes_codigo_reserva DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. Tiquete CONFIRMADO — SKY102 (BOG -> MDE, noche), asiento 3B
-- -----------------------------------------------------------------------------
INSERT INTO tiquetes (id_tiquete, codigo_reserva, id_vuelo, id_pasajero, id_asiento, estado, precio_pagado)
SELECT
    'd4000000-0000-0000-0000-000000000002',
    'PRUEB2',
    v.id_vuelo,
    'c3000000-0000-0000-0000-000000000001',
    a.id_asiento,
    'CONFIRMADO',
    v.precio_base
FROM vuelos v
JOIN asientos a ON a.id_avion = v.id_avion AND a.codigo_asiento = '3B'
WHERE v.id_vuelo = 'b2000000-0000-0000-0000-000000000002'
ON CONFLICT ON CONSTRAINT uq_tiquetes_codigo_reserva DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Tiquete CANCELADO — SKY100, asiento 3C (extra, opcional)
-- -----------------------------------------------------------------------------
-- No cuenta para el índice único parcial (que solo protege estados
-- distintos de CANCELADO), así que convive sin problema con los dos de
-- arriba. Se agrega para que la tabla de historial en el frontend se
-- pueda probar con más de un color de badge de estado (verde/rojo), no
-- solo "CONFIRMADO".
INSERT INTO tiquetes (id_tiquete, codigo_reserva, id_vuelo, id_pasajero, id_asiento, estado, precio_pagado)
SELECT
    'd4000000-0000-0000-0000-000000000003',
    'PRUEB3',
    v.id_vuelo,
    'c3000000-0000-0000-0000-000000000001',
    a.id_asiento,
    'CANCELADO',
    v.precio_base
FROM vuelos v
JOIN asientos a ON a.id_avion = v.id_avion AND a.codigo_asiento = '3C'
WHERE v.id_vuelo = 'b2000000-0000-0000-0000-000000000001'
ON CONFLICT ON CONSTRAINT uq_tiquetes_codigo_reserva DO NOTHING;

COMMIT;

-- -----------------------------------------------------------------------------
-- Referencia rápida: así se ve el historial insertado (misma forma que
-- devuelve GET /api/usuarios/:id/historial).
-- -----------------------------------------------------------------------------
SELECT
    t.codigo_reserva,
    v.numero_vuelo,
    v.origen || ' - ' || v.destino AS ruta,
    v.fecha_hora_salida,
    a.codigo_asiento,
    t.estado
FROM tiquetes t
JOIN vuelos v ON v.id_vuelo = t.id_vuelo
JOIN asientos a ON a.id_asiento = t.id_asiento
WHERE t.id_pasajero = 'c3000000-0000-0000-0000-000000000001'
ORDER BY v.fecha_hora_salida DESC;
