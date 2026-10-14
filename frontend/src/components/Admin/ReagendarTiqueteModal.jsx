import { useEffect, useRef, useState } from 'react';
import { buscarVuelos } from '../../services/vuelosApi.js';
import { listarAsientosPorVuelo } from '../../services/asientosApi.js';
import { actualizarEstadoTiquete } from '../../services/adminApi.js';
import { useDisponibilidadVuelos } from '../../hooks/useDisponibilidadVuelos.js';
import CalendarioVuelos from '../Vuelos/CalendarioVuelos.jsx';
import IndicadorPaso from './IndicadorPaso.jsx';

const MENSAJE_ERROR_VUELOS = 'No fue posible cargar los vuelos.';
const MENSAJE_ERROR_ASIENTOS = 'No fue posible cargar los asientos de este vuelo.';
const MENSAJE_ERROR_REAGENDAR = 'No fue posible reagendar el tiquete.';

/** Errores del PATCH ante los que conviene recargar los asientos (alguien tomó el elegido). */
const CODIGOS_ASIENTO_INVALIDO = ['ASIENTO_NO_DISPONIBLE', 'ASIENTO_NO_ENCONTRADO'];

const formateadorFechaHora = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formateadorHora = new Intl.DateTimeFormat('es-CO', { timeStyle: 'short' });

/** `YYYY-MM-DD` en hora LOCAL (no `toISOString`, que usa UTC y puede correr el día). */
function aFechaLocalIso(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/** Fecha inicial de búsqueda: la del vuelo actual si es futura, si no hoy. */
function fechaInicialBusqueda(fechaHoraSalida) {
  const hoy = aFechaLocalIso(new Date());
  const fechaVuelo = fechaHoraSalida ? aFechaLocalIso(new Date(fechaHoraSalida)) : hoy;
  return fechaVuelo > hoy ? fechaVuelo : hoy;
}

function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  );
}

/**
 * Modal de reagendamiento de un tiquete (SCRUM-10), en dos pasos:
 *
 *   1. Elegir el nuevo vuelo (`GET /api/vuelos`, prellenado con la ruta del
 *      tiquete actual; solo vuelos futuros y con cupo).
 *   2. Elegir un asiento DISPONIBLE de ese vuelo (`GET /api/vuelos/:id/asientos`).
 *
 * Al confirmar ejecuta `PATCH /api/admin/tiquetes/:id/estado` con
 * `{ estado: 'REAGENDADO', nuevoVueloId, nuevoAsientoId }`. Los errores del
 * backend (400/404/409) se muestran dentro del modal para poder corregir
 * la elección sin perder el contexto; si el asiento ya no está disponible,
 * se recarga el mapa. El éxito se notifica al padre vía `onReagendado`
 * (que cierra el modal, muestra el toast y refresca la tabla).
 *
 * Igual que `ConfirmarCancelacionModal`: si `tiquete` es `null` no se
 * renderiza. El padre lo monta con `key={idTiquete}` para que cada apertura
 * empiece con estado limpio.
 */
function ReagendarTiqueteModal({ tiquete, onCerrar, onReagendado }) {
  const [paso, setPaso] = useState(1);
  const [busqueda, setBusqueda] = useState(() => ({
    origen: tiquete?.origen ?? '',
    destino: tiquete?.destino ?? '',
    fecha: fechaInicialBusqueda(tiquete?.fechaHoraSalida),
  }));
  const disponibilidad = useDisponibilidadVuelos(busqueda.origen, busqueda.destino);

  const [vuelos, setVuelos] = useState([]);
  const [cargandoVuelos, setCargandoVuelos] = useState(false);
  const [vueloSeleccionado, setVueloSeleccionado] = useState(null);

  const [asientos, setAsientos] = useState([]);
  const [cargandoAsientos, setCargandoAsientos] = useState(false);
  const [asientoSeleccionado, setAsientoSeleccionado] = useState(null);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  // Descarta respuestas de búsquedas viejas si el usuario busca de nuevo
  // antes de que la anterior termine.
  const idPeticionVuelos = useRef(0);
  const idPeticionAsientos = useRef(0);

  async function cargarVuelos(criterios = busqueda) {
    const idPeticion = ++idPeticionVuelos.current;
    setCargandoVuelos(true);
    setError(null);
    setVueloSeleccionado(null);
    try {
      const resultado = await buscarVuelos(criterios);
      if (idPeticion !== idPeticionVuelos.current) return;
      const ahora = Date.now();
      setVuelos(resultado.filter((vuelo) => new Date(vuelo.fechaHoraSalida).getTime() > ahora));
    } catch (err) {
      if (idPeticion !== idPeticionVuelos.current) return;
      setVuelos([]);
      setError(err.message || MENSAJE_ERROR_VUELOS);
    } finally {
      if (idPeticion === idPeticionVuelos.current) setCargandoVuelos(false);
    }
  }

  async function cargarAsientos(vueloId) {
    const idPeticion = ++idPeticionAsientos.current;
    setCargandoAsientos(true);
    setAsientoSeleccionado(null);
    try {
      const resultado = await listarAsientosPorVuelo(vueloId);
      if (idPeticion !== idPeticionAsientos.current) return;
      setAsientos(resultado.filter((asiento) => asiento.estado === 'DISPONIBLE'));
    } catch (err) {
      if (idPeticion !== idPeticionAsientos.current) return;
      setAsientos([]);
      setError(err.message || MENSAJE_ERROR_ASIENTOS);
    } finally {
      if (idPeticion === idPeticionAsientos.current) setCargandoAsientos(false);
    }
  }

  // Búsqueda inicial con la ruta del tiquete actual.
  useEffect(() => {
    if (tiquete) cargarVuelos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape cierra el modal (salvo mientras se envía el PATCH).
  useEffect(() => {
    function manejarTecla(evento) {
      if (evento.key === 'Escape' && !enviando) onCerrar();
    }
    window.addEventListener('keydown', manejarTecla);
    return () => window.removeEventListener('keydown', manejarTecla);
  }, [enviando, onCerrar]);

  if (!tiquete) return null;

  function manejarCambioBusqueda(evento) {
    const { name, value } = evento.target;
    setBusqueda((previa) => ({
      ...previa,
      [name]: value.toUpperCase().slice(0, 3),
    }));
  }

  function manejarBuscar(evento) {
    evento.preventDefault();
    cargarVuelos();
  }

  // Elegir un día en el calendario busca de inmediato: es la acción
  // natural tras ver qué días tienen vuelos, sin un clic extra en "Buscar".
  function manejarCambioFecha(fecha) {
    const criterios = { ...busqueda, fecha };
    setBusqueda(criterios);
    cargarVuelos(criterios);
  }

  function irAPasoAsientos() {
    if (!vueloSeleccionado) return;
    setError(null);
    setPaso(2);
    cargarAsientos(vueloSeleccionado.idVuelo);
  }

  function volverAPasoVuelos() {
    setError(null);
    setAsientoSeleccionado(null);
    setPaso(1);
  }

  async function manejarConfirmar() {
    if (!vueloSeleccionado || !asientoSeleccionado || enviando) return;

    setEnviando(true);
    setError(null);
    try {
      const actualizado = await actualizarEstadoTiquete(tiquete.idTiquete, {
        estado: 'REAGENDADO',
        nuevoVueloId: vueloSeleccionado.idVuelo,
        nuevoAsientoId: asientoSeleccionado.idAsiento,
      });
      onReagendado(actualizado, { vuelo: vueloSeleccionado, asiento: asientoSeleccionado });
    } catch (err) {
      setError(err.message || MENSAJE_ERROR_REAGENDAR);
      if (CODIGOS_ASIENTO_INVALIDO.includes(err.code)) {
        cargarAsientos(vueloSeleccionado.idVuelo);
      }
    } finally {
      setEnviando(false);
    }
  }

  // Asientos disponibles agrupados por clase, en el orden en que llegan del backend.
  const asientosPorClase = asientos.reduce((grupos, asiento) => {
    (grupos[asiento.clase] ||= []).push(asiento);
    return grupos;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-reagendar"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-lg ring-1 ring-slate-100"
      >
        {/* Encabezado */}
        <div className="border-b border-slate-100 p-6">
          <h2 id="titulo-reagendar" className="text-lg font-semibold text-slate-800">
            Reagendar tiquete <span className="font-mono">{tiquete.codigoReserva}</span>
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {tiquete.nombrePasajero} · Actual: {tiquete.numeroVuelo} ({tiquete.origen} →{' '}
            {tiquete.destino}) · {formateadorFechaHora.format(new Date(tiquete.fechaHoraSalida))} ·
            Asiento {tiquete.codigoAsiento}
          </p>

          <div className="mt-4 flex items-center gap-3">
            <IndicadorPaso numero={1} titulo="Nuevo vuelo" activo={paso === 1} completado={paso > 1} />
            <span className="h-px w-8 bg-slate-200" />
            <IndicadorPaso numero={2} titulo="Nuevo asiento" activo={paso === 2} completado={false} />
          </div>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          {paso === 1 && (
            <div className="flex flex-col gap-4">
              <form onSubmit={manejarBuscar} className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:items-end">
                <div className="flex flex-col gap-1">
                  <label htmlFor="reagendar-origen" className="text-sm font-medium text-slate-700">
                    Origen
                  </label>
                  <input
                    id="reagendar-origen"
                    name="origen"
                    type="text"
                    required
                    value={busqueda.origen}
                    onChange={manejarCambioBusqueda}
                    className="rounded-lg border border-slate-300 px-3 py-2 uppercase focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="reagendar-destino" className="text-sm font-medium text-slate-700">
                    Destino
                  </label>
                  <input
                    id="reagendar-destino"
                    name="destino"
                    type="text"
                    required
                    value={busqueda.destino}
                    onChange={manejarCambioBusqueda}
                    className="rounded-lg border border-slate-300 px-3 py-2 uppercase focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="reagendar-fecha" className="text-sm font-medium text-slate-700">
                    Fecha
                  </label>
                  <CalendarioVuelos
                    id="reagendar-fecha"
                    value={busqueda.fecha}
                    onChange={manejarCambioFecha}
                    fechasConVuelos={disponibilidad.fechas}
                    cargando={disponibilidad.cargando}
                    rutaCompleta={disponibilidad.rutaCompleta}
                    alinear="derecha"
                  />
                </div>
                <button
                  type="submit"
                  disabled={cargandoVuelos}
                  className="flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {cargandoVuelos && <Spinner />}
                  Buscar
                </button>
              </form>

              {cargandoVuelos && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                  <Spinner className="h-5 w-5 text-sky-600" /> Buscando vuelos...
                </div>
              )}

              {!cargandoVuelos && vuelos.length === 0 && !error && (
                <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No hay vuelos futuros para esa ruta y fecha. Prueba con otra fecha.
                </p>
              )}

              {!cargandoVuelos && vuelos.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {vuelos.map((vuelo) => {
                    const sinCupo = vuelo.asientosDisponibles === 0;
                    const seleccionado = vueloSeleccionado?.idVuelo === vuelo.idVuelo;
                    const esVueloActual = vuelo.numeroVuelo === tiquete.numeroVuelo &&
                      vuelo.fechaHoraSalida === tiquete.fechaHoraSalida;

                    return (
                      <li key={vuelo.idVuelo}>
                        <button
                          type="button"
                          disabled={sinCupo}
                          onClick={() => setVueloSeleccionado(vuelo)}
                          aria-pressed={seleccionado}
                          className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            seleccionado
                              ? 'border-sky-600 bg-sky-50 ring-1 ring-sky-600'
                              : 'border-slate-200 hover:border-sky-300 hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                              {vuelo.numeroVuelo}
                              {esVueloActual && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                  Vuelo actual
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500">
                              {vuelo.origen} → {vuelo.destino} ·{' '}
                              {formateadorHora.format(new Date(vuelo.fechaHoraSalida))} –{' '}
                              {formateadorHora.format(new Date(vuelo.fechaHoraLlegada))}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-semibold ${sinCupo ? 'text-red-600' : 'text-green-700'}`}
                          >
                            {sinCupo ? 'Sin cupo' : `${vuelo.asientosDisponibles} disponibles`}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {paso === 2 && vueloSeleccionado && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{vueloSeleccionado.numeroVuelo}</p>
                  <p className="text-xs text-slate-500">
                    {vueloSeleccionado.origen} → {vueloSeleccionado.destino} ·{' '}
                    {formateadorFechaHora.format(new Date(vueloSeleccionado.fechaHoraSalida))}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={volverAPasoVuelos}
                  disabled={enviando}
                  className="text-sm font-medium text-sky-600 hover:text-sky-700 disabled:opacity-50"
                >
                  Cambiar vuelo
                </button>
              </div>

              {cargandoAsientos && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                  <Spinner className="h-5 w-5 text-sky-600" /> Cargando asientos...
                </div>
              )}

              {!cargandoAsientos && asientos.length === 0 && (
                <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Este vuelo ya no tiene asientos disponibles. Elige otro vuelo.
                </p>
              )}

              {!cargandoAsientos &&
                Object.entries(asientosPorClase).map(([clase, asientosDeClase]) => (
                  <div key={clase}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {clase} · {asientosDeClase.length} disponibles
                    </h3>
                    <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
                      {asientosDeClase.map((asiento) => {
                        const seleccionado = asientoSeleccionado?.idAsiento === asiento.idAsiento;
                        return (
                          <button
                            key={asiento.idAsiento}
                            type="button"
                            onClick={() => setAsientoSeleccionado(asiento)}
                            disabled={enviando}
                            aria-pressed={seleccionado}
                            className={`rounded-lg border py-2 text-sm font-semibold transition-colors ${
                              seleccionado
                                ? 'border-sky-600 bg-sky-600 text-white'
                                : 'border-slate-200 text-slate-700 hover:border-sky-300 hover:bg-sky-50'
                            }`}
                          >
                            {asiento.codigoAsiento}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 p-6">
          <p className="text-sm text-slate-500">
            {paso === 2 && asientoSeleccionado
              ? `Nuevo asiento: ${asientoSeleccionado.codigoAsiento}`
              : ''}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCerrar}
              disabled={enviando}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cerrar
            </button>

            {paso === 1 ? (
              <button
                type="button"
                onClick={irAPasoAsientos}
                disabled={!vueloSeleccionado}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Continuar
              </button>
            ) : (
              <button
                type="button"
                onClick={manejarConfirmar}
                disabled={!asientoSeleccionado || enviando}
                className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {enviando && <Spinner />}
                {enviando ? 'Reagendando...' : 'Confirmar reagendamiento'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReagendarTiqueteModal;
