function obtenerBadgeDisponibilidad(asientosDisponibles) {
  if (asientosDisponibles === 0) {
    return { texto: 'Agotado', clase: 'bg-red-100 text-red-700' };
  }
  if (asientosDisponibles < 10) {
    return { texto: `${asientosDisponibles} asientos`, clase: 'bg-orange-100 text-orange-700' };
  }
  return { texto: `${asientosDisponibles} asientos`, clase: 'bg-green-100 text-green-700' };
}

function formatearHora(fechaIso) {
  return new Date(fechaIso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function calcularDuracion(salidaIso, llegadaIso) {
  const minutosTotales = Math.round((new Date(llegadaIso) - new Date(salidaIso)) / 60_000);
  const horas = Math.floor(minutosTotales / 60);
  const minutos = minutosTotales % 60;
  return `${horas}h ${minutos}m`;
}

const formateadorPrecio = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/**
 * Tarjeta de resultado de búsqueda. Puramente presentacional: recibe el
 * vuelo ya normalizado por `vuelosApi.js` (camelCase) y no conoce nada del
 * backend ni hace llamadas de red.
 */
function VueloCard({ vuelo }) {
  const badge = obtenerBadgeDisponibilidad(vuelo.asientosDisponibles);

  return (
    <article className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100 transition-shadow hover:shadow-md">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold text-slate-800">
            {vuelo.origen} <span className="text-slate-400">→</span> {vuelo.destino}
          </p>
          <p className="text-sm text-slate-500">Vuelo {vuelo.numeroVuelo}</p>
        </div>
        <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${badge.clase}`}>
          {badge.texto}
        </span>
      </header>

      <div className="flex items-center justify-between text-slate-700">
        <div className="text-center">
          <p className="text-base font-semibold">{formatearHora(vuelo.fechaHoraSalida)}</p>
          <p className="text-xs text-slate-400">{vuelo.origen}</p>
        </div>
        <div className="flex flex-1 flex-col items-center px-3">
          <p className="text-xs text-slate-400">{calcularDuracion(vuelo.fechaHoraSalida, vuelo.fechaHoraLlegada)}</p>
          <div className="h-px w-full bg-slate-200" />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold">{formatearHora(vuelo.fechaHoraLlegada)}</p>
          <p className="text-xs text-slate-400">{vuelo.destino}</p>
        </div>
      </div>

      <footer className="flex items-center justify-between border-t border-slate-100 pt-3">
        <p className="text-sm text-slate-500">
          {vuelo.avion?.fabricante} {vuelo.avion?.modelo}
        </p>
        <p className="text-lg font-bold text-sky-700">{formateadorPrecio.format(vuelo.precioBase)}</p>
      </footer>
    </article>
  );
}

export default VueloCard;
