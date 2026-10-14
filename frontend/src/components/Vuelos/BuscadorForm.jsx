import { useMemo, useState } from 'react';
import CalendarioVuelos from './CalendarioVuelos.jsx';
import { useDisponibilidadVuelos } from '../../hooks/useDisponibilidadVuelos.js';

/**
 * Formulario de búsqueda de vuelos. Mantiene su propio estado local
 * (origen/destino/fecha) y delega la búsqueda real al padre vía `onBuscar`.
 * La única consulta de red propia es la disponibilidad del calendario
 * (`useDisponibilidadVuelos`), que se dispara sola al completar origen y
 * destino para resaltar los días con vuelos.
 */
function BuscadorForm({ onBuscar, isLoading = false }) {
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [fecha, setFecha] = useState('');
  const disponibilidad = useDisponibilidadVuelos(origen, destino);

  const origenNormalizado = origen.trim().toUpperCase();
  const destinoNormalizado = destino.trim().toUpperCase();

  const mismoOrigenDestino = useMemo(
    () => origenNormalizado.length > 0 && origenNormalizado === destinoNormalizado,
    [origenNormalizado, destinoNormalizado]
  );

  const formularioIncompleto = !origen || !destino || !fecha;
  const busquedaDeshabilitada = mismoOrigenDestino || formularioIncompleto || isLoading;

  function manejarSubmit(evento) {
    evento.preventDefault();
    if (busquedaDeshabilitada) return;
    onBuscar({ origen: origenNormalizado, destino: destinoNormalizado, fecha });
  }

  return (
    <form
      onSubmit={manejarSubmit}
      className="grid grid-cols-1 gap-4 rounded-xl bg-white p-4 shadow-sm sm:grid-cols-4 sm:items-end sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="origen" className="text-sm font-medium text-slate-700">
          Origen
        </label>
        <input
          id="origen"
          name="origen"
          type="text"
          maxLength={3}
          placeholder="BOG"
          value={origen}
          onChange={(evento) => setOrigen(evento.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 uppercase focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="destino" className="text-sm font-medium text-slate-700">
          Destino
        </label>
        <input
          id="destino"
          name="destino"
          type="text"
          maxLength={3}
          placeholder="MDE"
          value={destino}
          onChange={(evento) => setDestino(evento.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 uppercase focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="fecha" className="text-sm font-medium text-slate-700">
          Fecha
        </label>
        <CalendarioVuelos
          id="fecha"
          value={fecha}
          onChange={setFecha}
          fechasConVuelos={disponibilidad.fechas}
          cargando={disponibilidad.cargando}
          rutaCompleta={disponibilidad.rutaCompleta}
        />
      </div>

      <div className="flex flex-col gap-1">
        <button
          type="submit"
          disabled={busquedaDeshabilitada}
          className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isLoading ? 'Buscando...' : 'Buscar'}
        </button>
        {mismoOrigenDestino && (
          <p className="text-xs text-red-600">Origen y destino no pueden ser iguales.</p>
        )}
      </div>
    </form>
  );
}

export default BuscadorForm;
