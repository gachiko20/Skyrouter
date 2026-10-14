import { useState } from 'react';
import { buscarTiquetes, actualizarEstadoTiquete } from '../../services/adminApi.js';
import ConfirmarCancelacionModal from './ConfirmarCancelacionModal.jsx';
import ReagendarTiqueteModal from './ReagendarTiqueteModal.jsx';
import ToastAlerta from '../Cabina/ToastAlerta.jsx';

const ESTADO_INICIAL_FORM = { codigoReserva: '', documento: '' };

const MENSAJE_CRITERIO_REQUERIDO = 'Ingresa un código de reserva o un documento para buscar.';
const MENSAJE_ERROR_BUSQUEDA_GENERICO = 'No fue posible buscar tiquetes.';
const MENSAJE_ERROR_CANCELAR_GENERICO = 'No fue posible cancelar el tiquete.';

// Un tiquete ya reagendado puede volver a reagendarse (el backend lo
// permite: solo rechaza los CANCELADO). PENDIENTE no aplica: no está pago.
const ESTADOS_REAGENDABLES = ['CONFIRMADO', 'REAGENDADO'];

const formateadorFechaHora = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

// Mismos colores de estado que `FlightHistoryPage.jsx`: un mismo estado se
// ve igual en toda la app, sin importar qué vista lo muestre.
const ESTILOS_POR_ESTADO = {
  CONFIRMADO: 'bg-green-100 text-green-700',
  PENDIENTE: 'bg-amber-100 text-amber-700',
  CANCELADO: 'bg-red-100 text-red-700',
  REAGENDADO: 'bg-sky-100 text-sky-700',
};

function EstadoBadge({ estado }) {
  const clase = ESTILOS_POR_ESTADO[estado] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${clase}`}>
      {estado}
    </span>
  );
}

/**
 * Ruta `/admin/tiquetes`, montada dentro de `AdminLayout` (que ya garantiza
 * sesión + rol administrador/agente_comercial vía `ProtectedRoute`).
 *
 * Buscador básico (SCRUM-10) por código de reserva o documento del
 * pasajero (`GET /api/admin/tiquetes`), con acciones de Cancelar
 * (`PATCH /api/admin/tiquetes/:id/estado`, con modal de confirmación) y
 * Reagendar (tiquetes CONFIRMADO o REAGENDADO; `ReagendarTiqueteModal` guía la
 * elección de vuelo + asiento y ejecuta el mismo PATCH con
 * `estado: 'REAGENDADO'`).
 */
function AdminTiquetesPage() {
  const [form, setForm] = useState(ESTADO_INICIAL_FORM);
  const [tiquetes, setTiquetes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [yaBusco, setYaBusco] = useState(false);

  const [tiqueteEnConfirmacion, setTiqueteEnConfirmacion] = useState(null);
  const [cancelando, setCancelando] = useState(false);
  const [toast, setToast] = useState(null);

  const [tiqueteEnReagendamiento, setTiqueteEnReagendamiento] = useState(null);
  // Criterios de la última búsqueda exitosa, para refrescar la tabla tras
  // reagendar sin depender de que el formulario siga igual.
  const [ultimosCriterios, setUltimosCriterios] = useState(null);

  function manejarCambioForm(evento) {
    const { name, value } = evento.target;
    setForm((previo) => ({ ...previo, [name]: value }));
  }

  async function ejecutarBusqueda(criterios) {
    setIsLoading(true);
    setError(null);
    try {
      const resultado = await buscarTiquetes(criterios);
      setTiquetes(resultado);
      setUltimosCriterios(criterios);
    } catch (err) {
      setError(err.message || MENSAJE_ERROR_BUSQUEDA_GENERICO);
      setTiquetes([]);
    } finally {
      setIsLoading(false);
      setYaBusco(true);
    }
  }

  async function manejarBuscar(evento) {
    evento.preventDefault();
    if (isLoading) return;

    const codigoReserva = form.codigoReserva.trim();
    const documento = form.documento.trim();

    if (!codigoReserva && !documento) {
      setError(MENSAJE_CRITERIO_REQUERIDO);
      return;
    }

    await ejecutarBusqueda({
      codigoReserva: codigoReserva || undefined,
      documento: documento || undefined,
    });
  }

  function manejarReagendado(actualizado, { vuelo, asiento }) {
    setTiqueteEnReagendamiento(null);
    setToast({
      tipo: 'exito',
      mensaje: `Tiquete ${actualizado.codigoReserva} reagendado al vuelo ${vuelo.numeroVuelo}, asiento ${asiento.codigoAsiento}.`,
    });
    // La respuesta del PATCH no trae los campos enriquecidos de la búsqueda
    // (numeroVuelo, ruta, asiento...), que cambiaron todos: se repite la
    // última búsqueda para refrescar la fila con los datos reales.
    if (ultimosCriterios) ejecutarBusqueda(ultimosCriterios);
  }

  async function manejarConfirmarCancelacion() {
    if (!tiqueteEnConfirmacion || cancelando) return;

    setCancelando(true);
    try {
      const actualizado = await actualizarEstadoTiquete(tiqueteEnConfirmacion.idTiquete, {
        estado: 'CANCELADO',
      });
      // La respuesta del PATCH solo trae los campos "crudos" del tiquete
      // (ver `tiquetesAdminRepository.mapearTiqueteACamelCase`), no los
      // enriquecidos de la búsqueda (numeroVuelo, nombrePasajero, etc.):
      // se actualiza solo `estado` en la fila existente, en vez de
      // reemplazarla entera.
      setTiquetes((actuales) =>
        actuales.map((tiquete) =>
          tiquete.idTiquete === actualizado.idTiquete
            ? { ...tiquete, estado: actualizado.estado }
            : tiquete
        )
      );
      setToast({
        tipo: 'info',
        mensaje: `Tiquete ${actualizado.codigoReserva} cancelado correctamente.`,
      });
      setTiqueteEnConfirmacion(null);
    } catch (err) {
      setToast({ tipo: 'error', mensaje: err.message || MENSAJE_ERROR_CANCELAR_GENERICO });
      setTiqueteEnConfirmacion(null);
    } finally {
      setCancelando(false);
    }
  }

  const mostrarVacio = !isLoading && yaBusco && !error && tiquetes.length === 0;
  const mostrarResultados = !isLoading && tiquetes.length > 0;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Gestión de Tiquetes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Busca un tiquete por código de reserva o documento del pasajero para cancelarlo o
          reagendarlo.
        </p>
      </div>

      <form
        onSubmit={manejarBuscar}
        className="grid grid-cols-1 gap-4 rounded-xl bg-white p-4 shadow-sm sm:grid-cols-3 sm:items-end sm:p-6"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="codigoReserva" className="text-sm font-medium text-slate-700">
            Código de reserva
          </label>
          <input
            id="codigoReserva"
            name="codigoReserva"
            type="text"
            placeholder="ABC123"
            value={form.codigoReserva}
            onChange={manejarCambioForm}
            className="rounded-lg border border-slate-300 px-3 py-2 uppercase focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="documento" className="text-sm font-medium text-slate-700">
            Documento del pasajero
          </label>
          <input
            id="documento"
            name="documento"
            type="text"
            placeholder="CC 1234567"
            value={form.documento}
            onChange={manejarCambioForm}
            className="rounded-lg border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isLoading ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {mostrarVacio && (
        <div className="rounded-xl bg-white px-4 py-10 text-center shadow-sm ring-1 ring-slate-100">
          <p className="text-sm text-slate-500">No se encontraron tiquetes con ese criterio.</p>
        </div>
      )}

      {mostrarResultados && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Reserva
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Pasajero
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Vuelo
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Salida
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Estado
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tiquetes.map((tiquete) => {
                const yaCancelado = tiquete.estado === 'CANCELADO';
                const puedeReagendar = ESTADOS_REAGENDABLES.includes(tiquete.estado);
                return (
                  <tr key={tiquete.idTiquete} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-800">
                      {tiquete.codigoReserva}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                      <p>{tiquete.nombrePasajero}</p>
                      <p className="text-xs text-slate-400">{tiquete.documentoPasajero}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                      <p className="font-medium">{tiquete.numeroVuelo}</p>
                      <p className="text-xs text-slate-400">
                        {tiquete.origen} → {tiquete.destino} · {tiquete.codigoAsiento}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                      {formateadorFechaHora.format(new Date(tiquete.fechaHoraSalida))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <EstadoBadge estado={tiquete.estado} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={!puedeReagendar}
                          onClick={() => setTiqueteEnReagendamiento(tiquete)}
                          title={
                            puedeReagendar ? undefined : 'Solo se pueden reagendar tiquetes confirmados o reagendados'
                          }
                          className="rounded-lg border border-sky-200 px-3 py-1.5 text-sm font-medium text-sky-600 transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent"
                        >
                          Reagendar
                        </button>
                        <button
                          type="button"
                          disabled={yaCancelado}
                          onClick={() => setTiqueteEnConfirmacion(tiquete)}
                          title={yaCancelado ? 'Este tiquete ya está cancelado' : undefined}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent"
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmarCancelacionModal
        tiquete={tiqueteEnConfirmacion}
        isLoading={cancelando}
        onConfirmar={manejarConfirmarCancelacion}
        onCerrar={() => setTiqueteEnConfirmacion(null)}
      />

      {tiqueteEnReagendamiento && (
        <ReagendarTiqueteModal
          // key: cada apertura (incluso del mismo tiquete) arranca con estado limpio.
          key={tiqueteEnReagendamiento.idTiquete}
          tiquete={tiqueteEnReagendamiento}
          onCerrar={() => setTiqueteEnReagendamiento(null)}
          onReagendado={manejarReagendado}
        />
      )}

      {toast && (
        <ToastAlerta mensaje={toast.mensaje} tipo={toast.tipo} onCerrar={() => setToast(null)} />
      )}
    </div>
  );
}

export default AdminTiquetesPage;
