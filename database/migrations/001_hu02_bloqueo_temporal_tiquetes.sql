-- =============================================================================
-- Migración: bloqueo temporal de asientos (HU-02, SCRUM-8)
-- Ejecutar SOLO contra una base de datos que ya corrió database/init.sql
-- ANTES de este cambio. Una base de datos nueva no la necesita: init.sql ya
-- incluye este estado desde el primer arranque.
--
-- Uso:
--   psql -h localhost -U skyrouter -d skyrouter -f database/migrations/001_hu02_bloqueo_temporal_tiquetes.sql
-- =============================================================================

BEGIN;

ALTER TABLE tiquetes
    ADD COLUMN IF NOT EXISTS fecha_expiracion TIMESTAMPTZ;

COMMENT ON COLUMN tiquetes.fecha_expiracion IS
    'Solo aplica mientras estado = ''PENDIENTE'' (HU-02): instante en que expira el bloqueo temporal si no se confirma el pago.';

ALTER TABLE tiquetes DROP CONSTRAINT IF EXISTS ck_tiquetes_estado;
ALTER TABLE tiquetes
    ADD CONSTRAINT ck_tiquetes_estado CHECK (estado IN ('PENDIENTE', 'CONFIRMADO', 'CANCELADO', 'REAGENDADO'));

CREATE INDEX IF NOT EXISTS idx_tiquetes_pendientes_expiracion
    ON tiquetes (fecha_expiracion)
    WHERE estado = 'PENDIENTE';

COMMIT;
