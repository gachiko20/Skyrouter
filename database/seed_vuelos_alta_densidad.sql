-- =============================================================================
-- Sky Rout Operations — Datos de prueba de ALTA DENSIDAD: BOG <-> MDE
--
-- Complementa a `seed_vuelos_prueba_bog_mde.sql` y `seed_vuelos_extendido.sql`
-- (no los reemplaza): agrega 3 aviones nuevos de 30 asientos y 6 frecuencias
-- DIARIAS entre Bogotá y Medellín para todo octubre y noviembre de 2026
-- (61 días x 6 = 366 vuelos), para poder probar el reagendamiento a otro
-- horario del MISMO día desde el modal de administración.
--
-- Programación diaria (hora de Colombia, -05). Cada avión hace una
-- rotación de ida y vuelta, así ningún avión tiene dos vuelos a la vez:
--
--   Avión       Ida BOG -> MDE         Vuelta MDE -> BOG
--   HK-TEST4    SKY301  06:00-06:55    SKY302  08:00-08:55
--   HK-TEST5    SKY303  13:00-13:55    SKY304  15:00-15:55
--   HK-TEST6    SKY305  19:00-19:55    SKY306  21:00-21:55
--
-- Un número de vuelo identifica una FRECUENCIA (se repite cada día, como en
-- una aerolínea real); la unicidad la da `uq_vuelos_numero_salida`
-- (numero_vuelo, fecha_hora_salida), que es la restricción del ON CONFLICT.
-- SKY3xx no choca con los SKY1xx/SKY2xx de los otros seeds.
--
-- Idempotente: puede reejecutarse sin duplicar filas (ON CONFLICT DO NOTHING).
-- Requiere que `database/init.sql` ya se haya ejecutado.
--
-- Uso (PowerShell no admite `<`, por eso se usa Get-Content | ...):
--   Get-Content database/seed_vuelos_alta_densidad.sql | docker exec -i skyrouter-db psql -U skyrouter -d skyrouter
--   # o, desde Git Bash / Linux / macOS:
--   docker exec -i skyrouter-db psql -U skyrouter -d skyrouter < database/seed_vuelos_alta_densidad.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. AVIONES NUEVOS
-- -----------------------------------------------------------------------------
-- UUIDs fijos siguiendo la secuencia de los otros seeds (`a1000000-...-0001`
-- a `...-0003` ya existen), para poder referenciarlos abajo sin subconsultas.
INSERT INTO aviones (id_avion, matricula, modelo, fabricante, capacidad_total, anio_fabricacion, estado)
VALUES
    ('a1000000-0000-0000-0000-000000000004', 'HK-TEST4', 'A320neo', 'Airbus', 30, 2022, 'ACTIVO'),
    ('a1000000-0000-0000-0000-000000000005', 'HK-TEST5', 'A320neo', 'Airbus', 30, 2023, 'ACTIVO'),
    ('a1000000-0000-0000-0000-000000000006', 'HK-TEST6', 'B737 MAX 8', 'Boeing', 30, 2023, 'ACTIVO')
ON CONFLICT (matricula) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. ASIENTOS (mapa físico, todos DISPONIBLE por defecto)
-- -----------------------------------------------------------------------------
-- 5 filas x 6 columnas (A-F) = 30 asientos por avión, coherente con
-- `capacidad_total`: fila 1 EJECUTIVA, fila 2 PREMIUM_ECONOMY, filas 3-5
-- ECONOMICA. Se genera una sola vez por avión: `asientos` se reutiliza en
-- todos sus vuelos (la disponibilidad por vuelo la dan los tiquetes).
INSERT INTO asientos (id_avion, codigo_asiento, clase)
SELECT av.id_avion, fila || columna, c.clase
FROM unnest(ARRAY[
         'a1000000-0000-0000-0000-000000000004',
         'a1000000-0000-0000-0000-000000000005',
         'a1000000-0000-0000-0000-000000000006'
     ]::uuid[]) AS av(id_avion),
     generate_series(1, 5) AS fila,
     unnest(ARRAY['A', 'B', 'C', 'D', 'E', 'F']) AS columna,
     LATERAL (
         SELECT CASE
             WHEN fila = 1 THEN 'EJECUTIVA'
             WHEN fila = 2 THEN 'PREMIUM_ECONOMY'
             ELSE 'ECONOMICA'
         END AS clase
     ) AS c
ON CONFLICT (id_avion, codigo_asiento) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. VUELOS: 6 frecuencias diarias BOG <-> MDE, 2026-10-01 a 2026-11-30
-- -----------------------------------------------------------------------------
-- `(fecha + hora) AT TIME ZONE 'America/Bogota'` interpreta la hora local
-- de Colombia y la guarda como TIMESTAMPTZ correcto, sin importar la zona
-- horaria de la sesión de psql (UTC en Docker). Duración de 55 minutos.
-- El precio varía por franja: madrugada más barata, noche más cara.
INSERT INTO vuelos (numero_vuelo, id_avion, origen, destino, fecha_hora_salida, fecha_hora_llegada, precio_base)
SELECT
    f.numero_vuelo,
    f.id_avion,
    f.origen,
    f.destino,
    (dia::date + f.hora_salida) AT TIME ZONE 'America/Bogota',
    (dia::date + f.hora_salida + INTERVAL '55 minutes') AT TIME ZONE 'America/Bogota',
    f.precio_base
FROM generate_series(DATE '2026-10-01', DATE '2026-11-30', INTERVAL '1 day') AS dia
CROSS JOIN (
    VALUES
        ('SKY301', 'a1000000-0000-0000-0000-000000000004'::uuid, 'BOG', 'MDE', TIME '06:00', 210000.00),
        ('SKY302', 'a1000000-0000-0000-0000-000000000004'::uuid, 'MDE', 'BOG', TIME '08:00', 215000.00),
        ('SKY303', 'a1000000-0000-0000-0000-000000000005'::uuid, 'BOG', 'MDE', TIME '13:00', 245000.00),
        ('SKY304', 'a1000000-0000-0000-0000-000000000005'::uuid, 'MDE', 'BOG', TIME '15:00', 245000.00),
        ('SKY305', 'a1000000-0000-0000-0000-000000000006'::uuid, 'BOG', 'MDE', TIME '19:00', 275000.00),
        ('SKY306', 'a1000000-0000-0000-0000-000000000006'::uuid, 'MDE', 'BOG', TIME '21:00', 280000.00)
) AS f(numero_vuelo, id_avion, origen, destino, hora_salida, precio_base)
ON CONFLICT ON CONSTRAINT uq_vuelos_numero_salida DO NOTHING;

COMMIT;

-- -----------------------------------------------------------------------------
-- Verificación rápida
-- -----------------------------------------------------------------------------
-- Vuelos por ruta (esperado: 183 BOG->MDE y 183 MDE->BOG).
SELECT v.origen, v.destino, count(*) AS vuelos
FROM vuelos v
WHERE v.numero_vuelo BETWEEN 'SKY301' AND 'SKY306'
GROUP BY v.origen, v.destino
ORDER BY v.origen;

-- Muestra de un día, en hora de Colombia (esperado: 6 vuelos).
SELECT v.numero_vuelo, v.origen, v.destino,
       to_char(v.fecha_hora_salida AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS salida_col,
       a.matricula, v.precio_base
FROM vuelos v
JOIN aviones a ON a.id_avion = v.id_avion
WHERE (v.fecha_hora_salida AT TIME ZONE 'America/Bogota')::date = DATE '2026-11-02'
  AND v.numero_vuelo BETWEEN 'SKY301' AND 'SKY306'
ORDER BY v.fecha_hora_salida;
