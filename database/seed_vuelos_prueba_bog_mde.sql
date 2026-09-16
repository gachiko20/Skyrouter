-- =============================================================================
-- Sky Rout Operations — Datos de prueba: BOG -> MDE, 2026-09-24
--
-- Script de SEEDING manual (no es una migración): inserta un avión de
-- prueba, dos vuelos BOG->MDE en la fecha indicada y un mapa de asientos
-- disponibles, para poder probar el flujo completo (búsqueda -> selección
-- de asiento -> bloqueo HU-02 -> checkout/pago) sin depender de datos reales.
--
-- Idempotente: puede reejecutarse sin duplicar filas (ON CONFLICT DO NOTHING
-- sobre las mismas restricciones únicas que usa `init.sql`).
--
-- Uso:
--   docker exec -i skyrouter-db psql -U skyrouter -d skyrouter < database/seed_vuelos_prueba_bog_mde.sql
--   # o, si tienes psql instalado localmente:
--   psql -h localhost -U skyrouter -d skyrouter -f database/seed_vuelos_prueba_bog_mde.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. USUARIO DE PRUEBA (pasajero)
-- -----------------------------------------------------------------------------
-- No hay endpoint de registro/login todavía: el frontend toma este id fijo
-- vía VITE_USUARIO_ID_DEV (ver frontend/.env.example) mientras no exista
-- autenticación real (ver TODO en App.jsx).
INSERT INTO usuarios (id_usuario, nombres, apellidos, correo_electronico, hash_contrasena, telefono, documento_identidad, rol)
VALUES (
    'c3000000-0000-0000-0000-000000000001',
    'Usuario',
    'De Prueba',
    'usuario.prueba@skyrouter.test',
    'dev-sin-auth',
    '+57 300 000 0000',
    'DEV-000001',
    'pasajero'
)
ON CONFLICT (correo_electronico) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 1. AVIÓN DE PRUEBA
-- -----------------------------------------------------------------------------
INSERT INTO aviones (id_avion, matricula, modelo, fabricante, capacidad_total, anio_fabricacion, estado)
VALUES (
    'a1000000-0000-0000-0000-000000000001',
    'HK-TEST1',
    'A320-200',
    'Airbus',
    12,
    2018,
    'ACTIVO'
)
ON CONFLICT (matricula) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. VUELOS BOG -> MDE, 2026-09-24 (dos frecuencias: mañana y noche)
-- -----------------------------------------------------------------------------
INSERT INTO vuelos (id_vuelo, numero_vuelo, id_avion, origen, destino, fecha_hora_salida, fecha_hora_llegada, precio_base)
VALUES (
    'b2000000-0000-0000-0000-000000000001',
    'SKY100',
    'a1000000-0000-0000-0000-000000000001',
    'BOG',
    'MDE',
    TIMESTAMPTZ '2026-09-24 08:00:00-05',
    TIMESTAMPTZ '2026-09-24 08:50:00-05',
    250000
)
ON CONFLICT ON CONSTRAINT uq_vuelos_numero_salida DO NOTHING;

INSERT INTO vuelos (id_vuelo, numero_vuelo, id_avion, origen, destino, fecha_hora_salida, fecha_hora_llegada, precio_base)
VALUES (
    'b2000000-0000-0000-0000-000000000002',
    'SKY102',
    'a1000000-0000-0000-0000-000000000001',
    'BOG',
    'MDE',
    TIMESTAMPTZ '2026-09-24 18:30:00-05',
    TIMESTAMPTZ '2026-09-24 19:20:00-05',
    280000
)
ON CONFLICT ON CONSTRAINT uq_vuelos_numero_salida DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. ASIENTOS DEL AVIÓN DE PRUEBA (todos DISPONIBLE por defecto)
-- -----------------------------------------------------------------------------
-- `asientos` es el mapa físico del avión (se reutiliza en ambos vuelos de
-- arriba, ver `CONCURRENCY.md`): 3 filas x 4 columnas = 12 asientos.
INSERT INTO asientos (id_avion, codigo_asiento, clase)
SELECT 'a1000000-0000-0000-0000-000000000001', fila || columna, clase
FROM generate_series(1, 3) AS fila,
     unnest(ARRAY['A', 'B', 'C', 'D']) AS columna,
     LATERAL (SELECT CASE WHEN fila = 1 THEN 'EJECUTIVA' ELSE 'ECONOMICA' END AS clase) AS c
ON CONFLICT (id_avion, codigo_asiento) DO NOTHING;

COMMIT;

-- -----------------------------------------------------------------------------
-- Referencia rápida: IDs para probar los endpoints manualmente.
-- -----------------------------------------------------------------------------
SELECT v.id_vuelo, v.numero_vuelo, v.origen, v.destino, v.fecha_hora_salida
FROM vuelos v
WHERE v.id_avion = 'a1000000-0000-0000-0000-000000000001'
ORDER BY v.fecha_hora_salida;

SELECT a.id_asiento, a.codigo_asiento, a.clase, a.estado
FROM asientos a
WHERE a.id_avion = 'a1000000-0000-0000-0000-000000000001'
ORDER BY a.codigo_asiento;

SELECT id_usuario, nombres, apellidos, correo_electronico
FROM usuarios
WHERE id_usuario = 'c3000000-0000-0000-0000-000000000001';
