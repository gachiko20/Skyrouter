# Sky Rout Operations — Base de datos relacional

Esquema PostgreSQL para el backend de Sky Rout Operations. Reemplaza el control manual en hojas de Excel por persistencia centralizada, normalizada (3FN) e íntegra.

**Ticket:** `[Backend] Diseño de base de datos relacional (SCRUM-5)`
**Archivo ejecutable:** [`init.sql`](./init.sql)

## Cómo ejecutarlo

### Docker (recomendado)

```bash
docker run --name skyrouter-db \
  -e POSTGRES_USER=skyrouter \
  -e POSTGRES_PASSWORD=skyrouter \
  -e POSTGRES_DB=skyrouter \
  -v "$(pwd)/database/init.sql:/docker-entrypoint-initdb.d/01_init.sql" \
  -p 5432:5432 \
  -d postgres:16
```

El script se ejecuta automáticamente en el primer arranque del contenedor (carpeta `docker-entrypoint-initdb.d`). En arranques posteriores el volumen de datos ya existe y Postgres no lo vuelve a correr.

### Manual / contenedor ya corriendo

```bash
psql -h localhost -U skyrouter -d skyrouter -f database/init.sql
```

El script es idempotente (`IF NOT EXISTS`, `DROP TRIGGER IF EXISTS` + recreación), por lo que puede reejecutarse sin destruir datos existentes.

## Modelo Entidad-Relación

```
┌──────────────┐         ┌──────────────┐
│   usuarios   │         │    aviones   │
├──────────────┤         ├──────────────┤
│ id_usuario PK│         │ id_avion   PK│
│ nombres      │         │ matricula    │
│ apellidos    │         │ modelo       │
│ correo (UQ)  │         │ capacidad    │
│ rol          │         │ estado       │
└──────┬───────┘         └──────┬───────┘
       │                        │ 1
       │                        │
       │                        │ N
       │                 ┌──────┴───────┐        1   N   ┌──────────────┐
       │                 │    vuelos    │───────────────►│    asientos  │
       │                 ├──────────────┤   id_avion FK  ├──────────────┤
       │                 │ id_vuelo   PK│                │ id_asiento PK│
       │                 │ numero_vuelo │                │ id_avion  FK │
       │                 │ id_avion  FK │                │ codigo       │
       │                 │ origen       │                │ clase        │
       │                 │ destino      │                │ estado       │
       │                 │ fecha_salida │                └──────┬───────┘
       │                 │ fecha_llegada│                       │
       │                 │ estado       │                       │
       │                 └──────┬───────┘                       │
       │                        │ 1                              │ 1
       │ 1                      │                                │
       │                        │ N                               N
       │                 ┌──────┴────────────────────────────────┴───┐
       │  N              │                 tiquetes                  │
       └────────────────►├───────────────────────────────────────────┤
       (id_pasajero FK)  │ id_tiquete       PK                       │
                         │ codigo_reserva   UQ                       │
       ┌────────────────►│ id_vuelo         FK -> vuelos             │
       │  N (id_agente,  │ id_pasajero      FK -> usuarios           │
       │   opcional)     │ id_asiento       FK -> asientos           │
       └─────────────────│ id_agente        FK -> usuarios (nullable)│
                         │ estado                                    │
                         │ precio_pagado                             │
                         └───────────────────────────────────────────┘
```

### Cardinalidades

| Relación | Tipo | Regla de borrado |
|---|---|---|
| `aviones` → `vuelos` | 1:N | `RESTRICT` — no se borra un avión con vuelos programados |
| `aviones` → `asientos` | 1:N | `CASCADE` — el mapa de asientos es propiedad exclusiva del avión |
| `vuelos` → `tiquetes` | 1:N | `RESTRICT` — un vuelo con tiquetes emitidos se cancela, no se borra |
| `usuarios` (pasajero) → `tiquetes` | 1:N | `RESTRICT` — preserva el historial de compras |
| `usuarios` (agente) → `tiquetes` | 1:N (opcional) | `SET NULL` — si el agente se elimina, el tiquete conserva su historial |
| `asientos` → `tiquetes` | 1:N | `RESTRICT` |

## Decisiones de diseño relevantes

- **PK = UUID (`gen_random_uuid()`, vía `pgcrypto`)**: evita IDs secuenciales adivinables en endpoints públicos de reserva/consulta, y facilita generación de IDs desde el backend antes del `INSERT`.
- **Estados por `CHECK`, no `ENUM`**: se prefirió `VARCHAR + CHECK` sobre tipos `ENUM` de Postgres porque agregar un nuevo estado en producción (`ALTER TYPE ... ADD VALUE`) tiene restricciones dentro de transacciones; con `CHECK` un `ALTER TABLE ... DROP/ADD CONSTRAINT` es una migración trivial.
- **`asientos` pertenece a `aviones`, no a `vuelos`**: modela el mapa físico fijo del avión (mismo avión, mismos asientos en todos sus vuelos). La disponibilidad *por vuelo* (que un asiento se revende en cada itinerario) **no** depende de `asientos.estado`, sino del índice único parcial `uq_tiquetes_vuelo_asiento_activo` sobre `tiquetes (id_vuelo, id_asiento) WHERE estado <> 'CANCELADO'`. Ese índice es la restricción real anti-overbooking.
- **Trigger `fn_validar_asiento_pertenece_avion`**: ningún `FOREIGN KEY` puede expresar por sí solo "el asiento del tiquete debe pertenecer al avión del vuelo del tiquete" (relación entre 3 tablas). Se resuelve con un trigger `BEFORE INSERT/UPDATE` para que la integridad se garantice en la base de datos y no dependa de que la capa de aplicación la valide correctamente.
- **`fecha_actualizacion` automática**: trigger genérico (`fn_set_fecha_actualizacion`) reutilizado en `usuarios`, `vuelos` y `tiquetes` — evita que la app olvide actualizar el timestamp de auditoría.
- **Borrado lógico de usuarios**: `usuarios.activo` en vez de `DELETE`, combinado con `ON DELETE RESTRICT` desde `tiquetes`, protege el historial de compras exigido por trazabilidad/auditoría de una aerolínea.
- **Índice HU-01** (`idx_vuelos_origen_destino_fecha` sobre `vuelos(origen, destino, fecha_hora_salida)`): cubre la consulta más frecuente del sistema — buscador de vuelos por origen/destino/fecha — como índice compuesto en el orden de los filtros típicos (igualdad, igualdad, rango).

## Extensiones futuras sugeridas (fuera de alcance de SCRUM-5)

- Tabla `pagos` separada de `tiquetes` si se integra una pasarela de pagos con su propio ciclo de vida (autorizado/capturado/reembolsado).
- Tabla `tarifas` si el `precio_base` de un vuelo necesita variar por clase de asiento en vez de un único valor por vuelo.
- Particionamiento de `tiquetes` por rango de fecha si el volumen histórico crece significativamente.
