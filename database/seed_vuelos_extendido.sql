-- =============================================================================
-- Sky Rout Operations — Datos de prueba EXTENDIDOS: más rutas, vuelos y fechas
--
-- Complementa a `database/seed_vuelos_prueba_bog_mde.sql` (no lo reemplaza):
-- agrega 2 aviones nuevos, su mapa de asientos, y 15 vuelos nuevos cruzando
-- BOG (Bogotá), MDE (Medellín), CTG (Cartagena), CLO (Cali) y BAQ
-- (Barranquilla), repartidos entre octubre y noviembre de 2026 — para poder
-- probar el buscador del frontend con más variedad de origen/destino/fecha
-- que el único par BOG->MDE del seed básico.
--
-- Idempotente: puede reejecutarse sin duplicar filas (ON CONFLICT DO NOTHING
-- sobre las mismas restricciones únicas que usa `init.sql`, igual que el
-- seed básico).
--
-- Requiere que `database/init.sql` ya se haya ejecutado. No depende de
-- `seed_vuelos_prueba_bog_mde.sql` (usa sus propios aviones/IDs, sin tocar
-- los de ese script), pero normalmente se corren los dos juntos.
--
-- Uso:
--   docker exec -i skyrouter-db psql -U skyrouter -d skyrouter < database/seed_vuelos_extendido.sql
--   # o, si tienes psql instalado localmente:
--   psql -h localhost -U skyrouter -d skyrouter -f database/seed_vuelos_extendido.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. AVIONES NUEVOS
-- -----------------------------------------------------------------------------
-- Dos aeronaves adicionales a la del seed básico (`a1000000-...-0001`), con
-- UUIDs e IDs de matrícula propios para no chocar con ella.
INSERT INTO aviones (id_avion, matricula, modelo, fabricante, capacidad_total, anio_fabricacion, estado)
VALUES (
    'a1000000-0000-0000-0000-000000000002',
    'HK-TEST2',
    'A319-100',
    'Airbus',
    12,
    2019,
    'ACTIVO'
)
ON CONFLICT (matricula) DO NOTHING;

INSERT INTO aviones (id_avion, matricula, modelo, fabricante, capacidad_total, anio_fabricacion, estado)
VALUES (
    'a1000000-0000-0000-0000-000000000003',
    'HK-TEST3',
    'B737-800',
    'Boeing',
    12,
    2020,
    'ACTIVO'
)
ON CONFLICT (matricula) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. ASIENTOS DE LOS AVIONES NUEVOS (todos DISPONIBLE por defecto)
-- -----------------------------------------------------------------------------
-- Mismo patrón que `seed_vuelos_prueba_bog_mde.sql`: 3 filas x 4 columnas =
-- 12 asientos por avión, fila 1 EJECUTIVA y el resto ECONOMICA. `asientos`
-- es el mapa FÍSICO del avión (se reutiliza en todos sus vuelos, ver
-- `CONCURRENCY.md`), por eso se genera una sola vez por avión, cruzando su
-- id_avion específico.
INSERT INTO asientos (id_avion, codigo_asiento, clase)
SELECT 'a1000000-0000-0000-0000-000000000002', fila || columna, clase
FROM generate_series(1, 3) AS fila,
     unnest(ARRAY['A', 'B', 'C', 'D']) AS columna,
     LATERAL (SELECT CASE WHEN fila = 1 THEN 'EJECUTIVA' ELSE 'ECONOMICA' END AS clase) AS c
ON CONFLICT (id_avion, codigo_asiento) DO NOTHING;

INSERT INTO asientos (id_avion, codigo_asiento, clase)
SELECT 'a1000000-0000-0000-0000-000000000003', fila || columna, clase
FROM generate_series(1, 3) AS fila,
     unnest(ARRAY['A', 'B', 'C', 'D']) AS columna,
     LATERAL (SELECT CASE WHEN fila = 1 THEN 'EJECUTIVA' ELSE 'ECONOMICA' END AS clase) AS c
ON CONFLICT (id_avion, codigo_asiento) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. VUELOS NUEVOS — BOG / MDE / CTG / CLO / BAQ, octubre-noviembre 2026
-- -----------------------------------------------------------------------------
-- 15 frecuencias con numero_vuelo único (SKY201-SKY215), alternando entre
-- los dos aviones nuevos, cubriendo las 5 ciudades en distintas
-- combinaciones de ruta (sin repetir el mismo par origen-destino dos
-- veces) y con fechas de salida/llegada repartidas entre el 15 de octubre
-- y el 20 de noviembre de 2026.
INSERT INTO vuelos (id_vuelo, numero_vuelo, id_avion, origen, destino, fecha_hora_salida, fecha_hora_llegada, precio_base)
VALUES
    ('b2000000-0000-0000-0000-000000000010', 'SKY201', 'a1000000-0000-0000-0000-000000000002', 'BOG', 'MDE', TIMESTAMPTZ '2026-10-15 07:00:00-05', TIMESTAMPTZ '2026-10-15 07:50:00-05', 245000),
    ('b2000000-0000-0000-0000-000000000011', 'SKY202', 'a1000000-0000-0000-0000-000000000003', 'MDE', 'BOG', TIMESTAMPTZ '2026-10-16 09:15:00-05', TIMESTAMPTZ '2026-10-16 10:05:00-05', 245000),
    ('b2000000-0000-0000-0000-000000000012', 'SKY203', 'a1000000-0000-0000-0000-000000000002', 'BOG', 'CTG', TIMESTAMPTZ '2026-10-18 06:30:00-05', TIMESTAMPTZ '2026-10-18 08:10:00-05', 310000),
    ('b2000000-0000-0000-0000-000000000013', 'SKY204', 'a1000000-0000-0000-0000-000000000003', 'CTG', 'BOG', TIMESTAMPTZ '2026-10-19 19:00:00-05', TIMESTAMPTZ '2026-10-19 20:40:00-05', 310000),
    ('b2000000-0000-0000-0000-000000000014', 'SKY205', 'a1000000-0000-0000-0000-000000000002', 'BOG', 'CLO', TIMESTAMPTZ '2026-10-21 12:00:00-05', TIMESTAMPTZ '2026-10-21 13:05:00-05', 260000),
    ('b2000000-0000-0000-0000-000000000015', 'SKY206', 'a1000000-0000-0000-0000-000000000003', 'CLO', 'BOG', TIMESTAMPTZ '2026-10-22 14:30:00-05', TIMESTAMPTZ '2026-10-22 15:35:00-05', 260000),
    ('b2000000-0000-0000-0000-000000000016', 'SKY207', 'a1000000-0000-0000-0000-000000000002', 'BOG', 'BAQ', TIMESTAMPTZ '2026-10-24 10:00:00-05', TIMESTAMPTZ '2026-10-24 11:35:00-05', 300000),
    ('b2000000-0000-0000-0000-000000000017', 'SKY208', 'a1000000-0000-0000-0000-000000000003', 'BAQ', 'BOG', TIMESTAMPTZ '2026-10-25 20:15:00-05', TIMESTAMPTZ '2026-10-25 21:50:00-05', 300000),
    ('b2000000-0000-0000-0000-000000000018', 'SKY209', 'a1000000-0000-0000-0000-000000000002', 'MDE', 'CTG', TIMESTAMPTZ '2026-10-28 08:45:00-05', TIMESTAMPTZ '2026-10-28 09:55:00-05', 270000),
    ('b2000000-0000-0000-0000-000000000019', 'SKY210', 'a1000000-0000-0000-0000-000000000003', 'CTG', 'MDE', TIMESTAMPTZ '2026-10-30 17:20:00-05', TIMESTAMPTZ '2026-10-30 18:30:00-05', 270000),
    ('b2000000-0000-0000-0000-000000000020', 'SKY211', 'a1000000-0000-0000-0000-000000000002', 'MDE', 'CLO', TIMESTAMPTZ '2026-11-02 11:10:00-05', TIMESTAMPTZ '2026-11-02 11:55:00-05', 220000),
    ('b2000000-0000-0000-0000-000000000021', 'SKY212', 'a1000000-0000-0000-0000-000000000003', 'CLO', 'MDE', TIMESTAMPTZ '2026-11-04 15:40:00-05', TIMESTAMPTZ '2026-11-04 16:25:00-05', 220000),
    ('b2000000-0000-0000-0000-000000000022', 'SKY213', 'a1000000-0000-0000-0000-000000000002', 'CTG', 'BAQ', TIMESTAMPTZ '2026-11-08 09:00:00-05', TIMESTAMPTZ '2026-11-08 09:40:00-05', 180000),
    ('b2000000-0000-0000-0000-000000000023', 'SKY214', 'a1000000-0000-0000-0000-000000000003', 'BAQ', 'CTG', TIMESTAMPTZ '2026-11-12 18:00:00-05', TIMESTAMPTZ '2026-11-12 18:40:00-05', 180000),
    ('b2000000-0000-0000-0000-000000000024', 'SKY215', 'a1000000-0000-0000-0000-000000000002', 'CLO', 'BAQ', TIMESTAMPTZ '2026-11-20 06:45:00-05', TIMESTAMPTZ '2026-11-20 08:05:00-05', 290000)
ON CONFLICT ON CONSTRAINT uq_vuelos_numero_salida DO NOTHING;

COMMIT;

-- -----------------------------------------------------------------------------
-- Referencia rápida: vuelos insertados, para probar el buscador manualmente.
-- -----------------------------------------------------------------------------
SELECT v.numero_vuelo, v.origen, v.destino, v.fecha_hora_salida, v.fecha_hora_llegada, v.precio_base
FROM vuelos v
WHERE v.id_avion IN ('a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003')
ORDER BY v.fecha_hora_salida;
