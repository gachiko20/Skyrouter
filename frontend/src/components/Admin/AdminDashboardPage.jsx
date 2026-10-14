import { useEffect, useState } from 'react';
import { obtenerMetricas } from '../../services/adminApi.js';
import AdminDashboardSkeleton from './AdminDashboardSkeleton.jsx';

const MENSAJE_ERROR_GENERICO = 'No fue posible cargar las métricas administrativas.';
const MENSAJE_SIN_VUELOS = 'No hay vuelos próximos para mostrar.';

const formateadorMoneda = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const formateadorFechaHora = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'long',
  timeStyle: 'short',
});

// Mismos colores que ya usa `FlightHistoryPage.jsx` para el badge de estado
// de un tiquete: un mismo estado siempre se ve igual en toda la app, acá
// como tarjeta en vez de pastilla. El orden es a propósito (los estados
// "en curso" primero, CANCELADO al final) y no el que devuelva el backend.
const ORDEN_ESTADOS = ['CONFIRMADO', 'PENDIENTE', 'REAGENDADO', 'CANCELADO'];
const CONFIG_ESTADO = {
  CONFIRMADO: { etiqueta: 'Confirmados', clase: 'border-green-200 bg-green-50 text-green-700' },
  PENDIENTE: { etiqueta: 'Pendientes', clase: 'border-amber-200 bg-amber-50 text-amber-700' },
  REAGENDADO: { etiqueta: 'Reagendados', clase: 'border-sky-200 bg-sky-50 text-sky-700' },
  CANCELADO: { etiqueta: 'Cancelados', clase: 'border-red-200 bg-red-50 text-red-700' },
};

/**
 * Barra de ocupación de un vuelo. Un solo color neutro (no semáforo
 * rojo/ámbar/verde): a diferencia del estado de un tiquete, una ocupación
 * alta es BUENA para la aerolínea, así que no tiene sentido pintarla como
 * una alerta — sería engañoso.
 */
function BarraOcupacion({ porcentaje }) {
  const porcentajeAcotado = Math.min(100, Math.max(0, porcentaje));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-sky-600" style={{ width: `${porcentajeAcotado}%` }} />
      </div>
      <span className="text-sm font-medium text-slate-700">{porcentaje}%</span>
    </div>
  );
}

/**
 * Ruta `/admin/dashboard`, montada dentro de `AdminLayout` (que ya
 * garantiza sesión + rol administrador/agente_comercial vía
 * `ProtectedRoute`). Consume `GET /api/admin/metricas` (backend en Clean
 * Architecture: adminController -> obtenerMetricasAdminUseCase ->
 * metricasAdminRepository) y muestra: ingresos totales, distribución de
 * tiquetes por estado, y ocupación de los próximos vuelos.
 */
function AdminDashboardPage() {
  const [metricas, setMetricas] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;

    setIsLoading(true);
    setError(null);

    obtenerMetricas()
      .then((resultado) => {
        if (!cancelado) setMetricas(resultado);
      })
      .catch((err) => {
        if (!cancelado) setError(err.message || MENSAJE_ERROR_GENERICO);
      })
      .finally(() => {
        if (!cancelado) setIsLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Métricas generales del sistema.</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {isLoading && <AdminDashboardSkeleton />}

      {!isLoading && !error && metricas && (
        <>
          <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ingresos totales
            </p>
            <p className="mt-1 text-3xl font-bold text-slate-800">
              {formateadorMoneda.format(metricas.ingresosTotales)}
            </p>
          </section>

          <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {ORDEN_ESTADOS.map((estado) => {
              const { etiqueta, clase } = CONFIG_ESTADO[estado];
              const cantidad = metricas.tiquetesPorEstado[estado] ?? 0;
              return (
                <div key={estado} className={`rounded-xl border p-4 ${clase}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                    {etiqueta}
                  </p>
                  <p className="mt-1 text-2xl font-bold">{cantidad}</p>
                </div>
              );
            })}
          </section>

          <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700">Próximos vuelos</h2>
            </div>

            {metricas.proximosVuelos.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">{MENSAJE_SIN_VUELOS}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        Vuelo
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        Ruta
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        Salida
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        Ocupación
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {metricas.proximosVuelos.map((vuelo) => (
                      <tr key={vuelo.idVuelo} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-800">
                          {vuelo.numeroVuelo}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                          {vuelo.origen} - {vuelo.destino}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                          {formateadorFechaHora.format(new Date(vuelo.fechaHoraSalida))}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <BarraOcupacion porcentaje={vuelo.porcentajeOcupacion} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default AdminDashboardPage;
