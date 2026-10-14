/**
 * Modal de confirmación antes de cancelar un tiquete (SCRUM-10). Puramente
 * presentacional: no sabe nada de la llamada a la API, solo notifica la
 * intención vía `onConfirmar`/`onCerrar`, igual que `Asiento.jsx` con
 * `onSeleccionar` en el plano de cabina.
 *
 * `tiquete` es el que se va a cancelar; si es `null` el modal no se
 * renderiza (patrón "controlado por la presencia del dato", sin un booleano
 * `abierto` aparte que pueda desincronizarse de cuál tiquete era).
 */
function ConfirmarCancelacionModal({ tiquete, isLoading, onConfirmar, onCerrar }) {
  if (!tiquete) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg ring-1 ring-slate-100">
        <h2 className="text-lg font-semibold text-slate-800">Cancelar tiquete</h2>
        <p className="mt-2 text-sm text-slate-600">
          ¿Seguro que quieres cancelar el tiquete <strong>{tiquete.codigoReserva}</strong> del
          vuelo <strong>{tiquete.numeroVuelo}</strong> ({tiquete.origen} → {tiquete.destino}) a
          nombre de <strong>{tiquete.nombrePasajero}</strong>? Esta acción libera el asiento para
          que otro pasajero pueda reservarlo.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCerrar}
            disabled={isLoading}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={isLoading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            {isLoading ? 'Cancelando...' : 'Sí, cancelar tiquete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmarCancelacionModal;
