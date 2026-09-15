# Control de concurrencia — Reserva de asientos

**Ticket:** `[Backend] Lógica de Control de Concurrencia y Transacciones Atómicas (SCRUM-6)`

## El problema

Dos (o veinte) pasajeros pueden intentar reservar el **mismo asiento físico
en el mismo vuelo** en la misma fracción de segundo. Sin control de
concurrencia explícito, el flujo típico "leer estado → validar en memoria →
escribir" sufre una condición de carrera clásica (TOCTOU — *time-of-check
to time-of-use*): dos requests leen `DISPONIBLE` antes de que cualquiera
escriba, ambas pasan la validación y ambas confirman el mismo asiento. En
una aerolínea eso es overbooking real, con costo operativo y reputacional.

## Por qué Pessimistic Locking (`SELECT ... FOR UPDATE`) y no Optimistic Locking

| | Optimistic Locking (columna `version`/timestamp + `UPDATE ... WHERE version = X`) | Pessimistic Locking (`SELECT ... FOR UPDATE`) |
|---|---|---|
| Cómo evita la doble reserva | Detecta el conflicto **después**: la segunda transacción falla al hacer `UPDATE` porque `version` ya cambió, y debe manejar el reintento en la capa de aplicación. | Lo evita **antes**: la segunda transacción queda bloqueada en el `SELECT FOR UPDATE` hasta que la primera termina (COMMIT/ROLLBACK), y al reanudar ve el estado ya actualizado. |
| Comportamiento bajo alta contención sobre el mismo recurso | Bajo throughput real cuando muchas transacciones compiten por la misma fila: la mayoría falla y debe reintentar, multiplicando trabajo desperdiciado (reservar tiquete + rollback + reintento) justo en el escenario que más nos importa: un asiento popular con demanda simultánea. | Las transacciones se **serializan en cola** sobre esa fila específica; cada una hace exactamente el trabajo necesario, sin reintentos en bucle. El costo es esperar el lock, no repetir trabajo. |
| Superficie de error | Requiere lógica de reintento explícita y correcta en cada caller; si se omite, el usuario recibe un fallo genérico en vez de una respuesta clara de "ya no disponible". | El resultado es determinístico dentro de la transacción: o se obtiene el lock y se reserva, o se detecta el conflicto de forma inmediata y explícita (`ASIENTO_NO_DISPONIBLE`). |
| Garantía real de 0% overbooking | Depende de que TODA la capa de aplicación implemente el patrón compare-and-swap correctamente, siempre. Un solo endpoint que olvide el chequeo de versión rompe la garantía. | La garantía vive en la base de datos (el lock + el índice único parcial `uq_tiquetes_vuelo_asiento_activo` como red de seguridad), no solo en disciplina de código de aplicación. |

**Conclusión:** en un dominio de "un asiento, un pasajero, sin excepciones",
donde perder una venta por contención es aceptable pero venderla dos veces
no lo es, el bloqueo pesimista es la elección correcta: prioriza
consistencia estricta y comportamiento determinístico sobre throughput
máximo. Optimistic Locking es preferible cuando los conflictos son raros y
el costo de reintentar es bajo (ediciones colaborativas de documentos,
perfiles de usuario); no es el caso de una reserva de asiento con alta
demanda puntual (ej. vuelos populares, ofertas).

## Cómo se implementó (adaptado al esquema real de SCRUM-5)

El esquema (`database/init.sql`) modela `asientos` como el mapa **físico**
de un avión: el mismo asiento se reutiliza en todos los vuelos de esa
aeronave, y la disponibilidad real *por vuelo* la garantiza el índice único
parcial:

```sql
CREATE UNIQUE INDEX uq_tiquetes_vuelo_asiento_activo
    ON tiquetes (id_vuelo, id_asiento)
    WHERE estado <> 'CANCELADO';
```

Por eso `asientos.estado` **no** se usa como "reservado para este vuelo"
(eso inhabilitaría el asiento en todos los demás vuelos del avión). La
secuencia implementada en `src/services/asientosService.js`, dentro de una
única transacción (`withTransaction`):

1. `SELECT a.estado, v.precio_base FROM asientos a JOIN vuelos v ON ... WHERE a.id_asiento = $1 AND v.id_vuelo = $2 FOR UPDATE OF a` — bloquea la fila física del asiento, serializando cualquier intento concurrente sobre ese mismo asiento.
2. Bajo ese lock, se valida `asientos.estado = 'DISPONIBLE'` (disponibilidad administrativa) y se consulta si ya existe un tiquete activo para `(id_vuelo, id_asiento)` — lectura libre de carreras gracias al paso 1.
3. Si ambas validaciones pasan, se hace `INSERT INTO tiquetes (...)`. Si no, se lanza un error de negocio `ASIENTO_NO_DISPONIBLE` y la transacción hace `ROLLBACK`.
4. El índice único parcial actúa como última línea de defensa a nivel de base de datos si, por cualquier razón, dos transacciones llegaran al `INSERT` sin haber pasado por el lock (defensa en profundidad).

## Manejo de errores

`src/middlewares/errorHandler.js` traduce a `409 Conflict` tanto los
errores de negocio (`ConflictError` con `code: 'ASIENTO_NO_DISPONIBLE'`)
como los SQLSTATE de PostgreSQL asociados a conflictos de concurrencia
(`40P01` deadlock, `55P03` lock_not_available, `23505` unique_violation),
de modo que ningún camino de código deja escapar un conflicto de
concurrencia como un 500 genérico.

## Cómo probarlo

```bash
cp .env.example .env          # ajustar credenciales si aplica
npm install
npm start                     # levanta la API en :3000 (requiere Postgres con database/init.sql ya aplicado)

# en otra terminal:
npm run test:stress
```

`tests/stress/concurrencyTest.js` siembra su propio avión/vuelo/asiento/20
usuarios, dispara 20 `POST` simultáneos al mismo asiento con `Promise.all`,
y verifica tanto las respuestas HTTP (1×200 + 19×409) como el estado final
en PostgreSQL (exactamente 1 tiquete activo) — la prueba real de que no
hubo overbooking es la fila en base de datos, no solo el código HTTP.
