-- =============================================================================
-- Sky Rout Operations — Esquema relacional PostgreSQL
-- Ticket: [Backend] Diseño de base de datos relacional (SCRUM-5)
-- Motor objetivo: PostgreSQL 14+ (probado sobre imagen oficial postgres:16)
--
-- Este script es idempotente: puede ejecutarse repetidas veces sobre la misma
-- base de datos sin fallar (CREATE ... IF NOT EXISTS / DROP ... IF EXISTS).
-- Pensado para montarse en /docker-entrypoint-initdb.d/ de un contenedor
-- oficial de PostgreSQL, donde se ejecuta automáticamente en el primer
-- arranque del contenedor.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. EXTENSIONES
-- -----------------------------------------------------------------------------
-- pgcrypto habilita gen_random_uuid(), usada como estrategia de PK para evitar
-- IDs secuenciales predecibles/enumerables en un sistema expuesto a clientes
-- (pasajeros) y agentes externos.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. FUNCIONES DE SOPORTE
-- -----------------------------------------------------------------------------
-- Mantiene fecha_actualizacion sincronizada en cada UPDATE, sin depender de
-- que la capa de aplicación recuerde setearla manualmente.
CREATE OR REPLACE FUNCTION fn_set_fecha_actualizacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Garantiza integridad referencial "cruzada": el asiento asignado a un
-- tiquete debe pertenecer físicamente al avión operando ese vuelo. Esta
-- regla no es expresable con un FOREIGN KEY / CHECK simple porque involucra
-- tres tablas (tiquetes -> vuelos -> aviones <- asientos), por eso se
-- resuelve con un trigger a nivel de base de datos (no se delega solo a la
-- capa de aplicación).
CREATE OR REPLACE FUNCTION fn_validar_asiento_pertenece_avion()
RETURNS TRIGGER AS $$
DECLARE
    v_avion_vuelo UUID;
    v_avion_asiento UUID;
BEGIN
    SELECT id_avion INTO v_avion_vuelo FROM vuelos WHERE id_vuelo = NEW.id_vuelo;
    SELECT id_avion INTO v_avion_asiento FROM asientos WHERE id_asiento = NEW.id_asiento;

    IF v_avion_vuelo IS DISTINCT FROM v_avion_asiento THEN
        RAISE EXCEPTION 'El asiento % no pertenece al avión asignado al vuelo %', NEW.id_asiento, NEW.id_vuelo
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 2. TABLA: usuarios
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombres                 VARCHAR(100) NOT NULL,
    apellidos               VARCHAR(100) NOT NULL,
    correo_electronico      VARCHAR(150) NOT NULL,
    hash_contrasena         VARCHAR(255) NOT NULL,
    telefono                VARCHAR(20),
    documento_identidad     VARCHAR(30),
    rol                     VARCHAR(20) NOT NULL DEFAULT 'pasajero',
    activo                  BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_usuarios_correo UNIQUE (correo_electronico),
    CONSTRAINT uq_usuarios_documento UNIQUE (documento_identidad),
    CONSTRAINT ck_usuarios_rol CHECK (rol IN ('pasajero', 'agente_comercial', 'administrador')),
    CONSTRAINT ck_usuarios_correo_formato CHECK (correo_electronico ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

COMMENT ON TABLE usuarios IS 'Pasajeros, agentes comerciales y administradores del sistema.';

DROP TRIGGER IF EXISTS trg_usuarios_set_fecha_actualizacion ON usuarios;
CREATE TRIGGER trg_usuarios_set_fecha_actualizacion
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_fecha_actualizacion();

-- -----------------------------------------------------------------------------
-- 3. TABLA: aviones
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aviones (
    id_avion            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matricula           VARCHAR(15) NOT NULL,
    modelo              VARCHAR(60) NOT NULL,
    fabricante          VARCHAR(60),
    capacidad_total     INTEGER NOT NULL,
    anio_fabricacion    SMALLINT,
    estado              VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_aviones_matricula UNIQUE (matricula),
    CONSTRAINT ck_aviones_capacidad_positiva CHECK (capacidad_total > 0),
    CONSTRAINT ck_aviones_anio_valido CHECK (
        anio_fabricacion IS NULL
        OR anio_fabricacion BETWEEN 1950 AND (EXTRACT(YEAR FROM now())::SMALLINT + 1)
    ),
    CONSTRAINT ck_aviones_estado CHECK (estado IN ('ACTIVO', 'MANTENIMIENTO', 'INACTIVO'))
);

COMMENT ON TABLE aviones IS 'Flota de aeronaves operadas por la aerolínea.';

-- -----------------------------------------------------------------------------
-- 4. TABLA: vuelos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vuelos (
    id_vuelo             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_vuelo         VARCHAR(10) NOT NULL,
    id_avion             UUID NOT NULL,
    origen               CHAR(3) NOT NULL,
    destino              CHAR(3) NOT NULL,
    fecha_hora_salida    TIMESTAMPTZ NOT NULL,
    fecha_hora_llegada   TIMESTAMPTZ NOT NULL,
    estado               VARCHAR(20) NOT NULL DEFAULT 'PROGRAMADO',
    precio_base          NUMERIC(10,2) NOT NULL,
    fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_vuelos_avion FOREIGN KEY (id_avion)
        REFERENCES aviones (id_avion)
        ON DELETE RESTRICT   -- no se puede borrar un avión con vuelos asociados
        ON UPDATE CASCADE,

    CONSTRAINT uq_vuelos_numero_salida UNIQUE (numero_vuelo, fecha_hora_salida),
    CONSTRAINT ck_vuelos_origen_formato CHECK (origen ~ '^[A-Z]{3}$'),
    CONSTRAINT ck_vuelos_destino_formato CHECK (destino ~ '^[A-Z]{3}$'),
    CONSTRAINT ck_vuelos_origen_destino_distintos CHECK (origen <> destino),
    CONSTRAINT ck_vuelos_llegada_posterior_salida CHECK (fecha_hora_llegada > fecha_hora_salida),
    CONSTRAINT ck_vuelos_precio_no_negativo CHECK (precio_base >= 0),
    CONSTRAINT ck_vuelos_estado CHECK (
        estado IN ('PROGRAMADO', 'EMBARCANDO', 'EN_VUELO', 'ATERRIZADO', 'CANCELADO', 'REAGENDADO')
    )
);

COMMENT ON TABLE vuelos IS 'Itinerarios/frecuencias de vuelo: origen, destino, horarios y avión asignado.';

DROP TRIGGER IF EXISTS trg_vuelos_set_fecha_actualizacion ON vuelos;
CREATE TRIGGER trg_vuelos_set_fecha_actualizacion
    BEFORE UPDATE ON vuelos
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_fecha_actualizacion();

-- -----------------------------------------------------------------------------
-- 5. TABLA: asientos
-- -----------------------------------------------------------------------------
-- Representa el mapa físico de asientos de cada avión (estructura fija de la
-- aeronave: código, clase). El campo `estado` refleja la disponibilidad
-- operativa general del asiento (p.ej. BLOQUEADO por mantenimiento).
-- La disponibilidad *por vuelo* (que un mismo asiento físico se revende en
-- cada itinerario) se garantiza mediante el índice único parcial sobre
-- tiquetes (ver sección 6) y no depende de este campo.
CREATE TABLE IF NOT EXISTS asientos (
    id_asiento       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_avion         UUID NOT NULL,
    codigo_asiento   VARCHAR(5) NOT NULL,
    clase            VARCHAR(20) NOT NULL,
    estado           VARCHAR(20) NOT NULL DEFAULT 'DISPONIBLE',

    CONSTRAINT fk_asientos_avion FOREIGN KEY (id_avion)
        REFERENCES aviones (id_avion)
        ON DELETE CASCADE    -- el mapa de asientos es propiedad exclusiva del avión
        ON UPDATE CASCADE,

    CONSTRAINT uq_asientos_avion_codigo UNIQUE (id_avion, codigo_asiento),
    CONSTRAINT ck_asientos_codigo_formato CHECK (codigo_asiento ~ '^[0-9]{1,3}[A-Z]$'),
    CONSTRAINT ck_asientos_clase CHECK (clase IN ('ECONOMICA', 'PREMIUM_ECONOMY', 'EJECUTIVA', 'PRIMERA')),
    CONSTRAINT ck_asientos_estado CHECK (estado IN ('DISPONIBLE', 'BLOQUEADO', 'OCUPADO'))
);

COMMENT ON TABLE asientos IS 'Mapa físico de asientos por avión: código, clase y estado operativo.';

-- -----------------------------------------------------------------------------
-- 6. TABLA: tiquetes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tiquetes (
    id_tiquete           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_reserva       VARCHAR(6) NOT NULL,
    id_vuelo             UUID NOT NULL,
    id_pasajero          UUID NOT NULL,
    id_asiento           UUID NOT NULL,
    id_agente            UUID,
    estado               VARCHAR(20) NOT NULL DEFAULT 'CONFIRMADO',
    precio_pagado        NUMERIC(10,2) NOT NULL,
    -- Solo aplica mientras estado = 'PENDIENTE' (HU-02, SCRUM-8): instante en
    -- que expira el bloqueo temporal de selección si no se confirma el pago.
    -- La liberación/expiración automática es un job fuera del alcance de
    -- HU-02; esta columna solo deja la información persistida para ese job.
    fecha_expiracion     TIMESTAMPTZ,
    fecha_reserva        TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_tiquetes_vuelo FOREIGN KEY (id_vuelo)
        REFERENCES vuelos (id_vuelo)
        ON DELETE RESTRICT,  -- un vuelo con tiquetes emitidos no se borra, se cancela

    CONSTRAINT fk_tiquetes_pasajero FOREIGN KEY (id_pasajero)
        REFERENCES usuarios (id_usuario)
        ON DELETE RESTRICT,  -- preserva el historial de compras/tiquetes

    CONSTRAINT fk_tiquetes_asiento FOREIGN KEY (id_asiento)
        REFERENCES asientos (id_asiento)
        ON DELETE RESTRICT,

    CONSTRAINT fk_tiquetes_agente FOREIGN KEY (id_agente)
        REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL,  -- si el agente se elimina, el tiquete conserva su historial

    CONSTRAINT uq_tiquetes_codigo_reserva UNIQUE (codigo_reserva),
    CONSTRAINT ck_tiquetes_codigo_reserva_formato CHECK (codigo_reserva ~ '^[A-Z0-9]{6}$'),
    CONSTRAINT ck_tiquetes_precio_no_negativo CHECK (precio_pagado >= 0),
    -- 'PENDIENTE' (HU-02, SCRUM-8): bloqueo temporal de selección, previo a
    -- la confirmación de pago. 'CONFIRMADO': reserva/compra definitiva.
    CONSTRAINT ck_tiquetes_estado CHECK (estado IN ('PENDIENTE', 'CONFIRMADO', 'CANCELADO', 'REAGENDADO'))
);

COMMENT ON TABLE tiquetes IS 'Tiquetes emitidos: vínculo entre vuelo, pasajero y asiento, con su estado de reserva.';

-- Un mismo asiento no puede tener más de un tiquete activo (no cancelado)
-- para el mismo vuelo. Es la restricción real que impide el overbooking,
-- independiente del estado "administrativo" almacenado en asientos.estado.
-- Al filtrar solo por CANCELADO, esta misma restricción cubre tanto los
-- bloqueos temporales (PENDIENTE, HU-02) como las reservas confirmadas.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tiquetes_vuelo_asiento_activo
    ON tiquetes (id_vuelo, id_asiento)
    WHERE estado <> 'CANCELADO';

-- Soporta el futuro job de liberación de bloqueos temporales vencidos
-- (fuera de alcance de HU-02): permite encontrar rápidamente los PENDIENTE
-- cuya fecha_expiracion ya pasó, sin escanear toda la tabla.
CREATE INDEX IF NOT EXISTS idx_tiquetes_pendientes_expiracion
    ON tiquetes (fecha_expiracion)
    WHERE estado = 'PENDIENTE';

DROP TRIGGER IF EXISTS trg_tiquetes_set_fecha_actualizacion ON tiquetes;
CREATE TRIGGER trg_tiquetes_set_fecha_actualizacion
    BEFORE UPDATE ON tiquetes
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_fecha_actualizacion();

DROP TRIGGER IF EXISTS trg_tiquetes_validar_asiento_avion ON tiquetes;
CREATE TRIGGER trg_tiquetes_validar_asiento_avion
    BEFORE INSERT OR UPDATE OF id_vuelo, id_asiento ON tiquetes
    FOR EACH ROW
    EXECUTE FUNCTION fn_validar_asiento_pertenece_avion();

-- -----------------------------------------------------------------------------
-- 7. ÍNDICES DE OPTIMIZACIÓN
-- -----------------------------------------------------------------------------
-- HU-01: búsqueda de vuelos disponibles por origen, destino y fecha. Es la
-- consulta más frecuente del sistema (equivalente al buscador de vuelos de
-- cualquier aerolínea), por lo que se indexa la combinación completa.
CREATE INDEX IF NOT EXISTS idx_vuelos_origen_destino_fecha
    ON vuelos (origen, destino, fecha_hora_salida);

-- Búsquedas/filtrados secundarios habituales.
CREATE INDEX IF NOT EXISTS idx_vuelos_id_avion ON vuelos (id_avion);
CREATE INDEX IF NOT EXISTS idx_asientos_id_avion ON asientos (id_avion);
CREATE INDEX IF NOT EXISTS idx_tiquetes_id_vuelo ON tiquetes (id_vuelo);
CREATE INDEX IF NOT EXISTS idx_tiquetes_id_pasajero ON tiquetes (id_pasajero);
CREATE INDEX IF NOT EXISTS idx_tiquetes_id_asiento ON tiquetes (id_asiento);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios (rol);

COMMIT;
