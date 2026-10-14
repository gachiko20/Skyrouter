import { useEffect, useState } from 'react';
import { obtenerHistorialVuelos } from '../../services/historialApi.js';
import { useAuth } from '../../state/AuthContext.jsx';
import HistorialTableSkeleton from './HistorialTableSkeleton.jsx';
import HistorialEmptyState from './HistorialEmptyState.jsx';
import DescargarFacturaButton from '../Checkout/DescargarFacturaButton.jsx';

const MENSAJE_ERROR_GENERICO = 'No fue posible cargar el historial de vuelos.';

const formateadorFechaHora = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'long',
  timeStyle: 'short',
});

const ESTILOS_POR_ESTADO = {
  CONFIRMADO: 'bg-green-100 text-green-700',
  PENDIENTE: 'bg-amber-100 text-amber-700',
  CANCELADO: 'bg-red-100 text-red-700',
  REAGENDADO: 'bg-sky-100 text-sky-700',
};

/** Pastilla de color por `estado` del tiquete; cae a gris para un estado que no está en el mapa. */
function EstadoBadge({ estado }) {
  const clase = ESTILOS_POR_ESTADO[estado] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${clase}`}>
      {estado}
    </span>
  );
}

/**
 * Ruta `/mis-viajes`, montada dentro de `DashboardLayout` (que ya garantiza
 * sesión activa). Consume `GET /api/usuarios/:id/historial` (backend en
 * Clean Architecture: usuariosController -> obtenerHistorialVuelosUseCase
 * -> usuariosRepository, JOIN tiquetes/vuelos/asientos filtrando por
 * `id_pasajero`), usando el `idUsuario` real de `AuthContext` (SCRUM-49) en
 * vez del antiguo `VITE_USUARIO_ID_DEV`.
 */
function FlightHistoryPage() {
  const { usuario } = useAuth();
  const usuarioId = usuario.idUsuario;

  const [historial, setHistorial] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;

    setIsLoading(true);
    setError(null);

    obtenerHistorialVuelos(usuarioId)
      .then((resultado) => {
        if (!cancelado) setHistorial(resultado);
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
  }, [usuarioId]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Mis Viajes</h1>
        <p className="mt-1 text-sm text-slate-500">Historial de tiquetes reservados y comprados.</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {isLoading && <HistorialTableSkeleton />}

      {!isLoading && !error && historial.length === 0 && <HistorialEmptyState />}

      {!isLoading && !error && historial.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Fecha
                </th>
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
                  Estado
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historial.map((tiquete) => (
                <tr key={tiquete.idTiquete} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                    {formateadorFechaHora.format(new Date(tiquete.fechaHoraSalida))}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-800">
                    {tiquete.numeroVuelo}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{tiquete.ruta}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <EstadoBadge estado={tiquete.estado} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {/* PENDIENTE = bloqueo sin pago: el backend no factura (409). */}
                      {tiquete.estado !== 'PENDIENTE' && (
                        <DescargarFacturaButton tiqueteId={tiquete.idTiquete} tamanio="compacto" />
                      )}
                      <button
                        type="button"
                        disabled
                        title="Disponible próximamente"
                        className="cursor-not-allowed rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-400"
                      >
                        Ver detalle
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default FlightHistoryPage;
