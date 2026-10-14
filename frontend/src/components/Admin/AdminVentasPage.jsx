import { useCallback, useEffect, useState } from 'react';
import ListaVuelos from '../Vuelos/ListaVuelos.jsx';
import PlanoCabina from '../Cabina/PlanoCabina.jsx';
import CabinaSkeleton from '../Cabina/CabinaSkeleton.jsx';
import BookingSuccess from '../Checkout/BookingSuccess.jsx';
import IndicadorPaso from './IndicadorPaso.jsx';
import { listarAsientosPorVuelo } from '../../services/asientosApi.js';
import { registrarVentaAdmin } from '../../services/adminApi.js';

const PASOS = [
  { id: 'vuelo', titulo: 'Vuelo' },
  { id: 'asiento', titulo: 'Asiento' },
  { id: 'pasajero', titulo: 'Pasajero' },
];

const PASAJERO_INICIAL = { documento: '', nombres: '', apellidos: '', correo: '', telefono: '' };

const MENSAJE_ERROR_VENTA = 'No fue posible registrar la venta. Intenta nuevamente.';

const formateadorFechaHora = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' });
const formateadorMoneda = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' });

const CLASE_INPUT =
  'rounded-lg border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  );
}

/** Tarjeta-resumen del vuelo (y asiento) elegidos, con acción para volver atrás. */
function ResumenSeleccion({ vuelo, asiento, accion, onAccion, deshabilitado }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div>
        <p className="text-sm font-semibold text-slate-800">
          Vuelo {vuelo.numeroVuelo} · {vuelo.origen} → {vuelo.destino}
          {asiento && ` · Asiento ${asiento.codigoAsiento}`}
        </p>
        <p className="text-xs text-slate-500">{formateadorFechaHora.format(new Date(vuelo.fechaHoraSalida))}</p>
      </div>
      <button
        type="button"
        onClick={onAccion}
        disabled={deshabilitado}
        className="text-sm font-medium text-sky-600 hover:text-sky-700 disabled:opacity-50"
      >
        {accion}
      </button>
    </div>
  );
}

function CampoTexto({ id, etiqueta, opcional = false, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {etiqueta}
        {opcional && <span className="ml-1 font-normal text-slate-400">(opcional)</span>}
      </label>
      <input id={id} name={id} required={!opcional} className={CLASE_INPUT} {...props} />
    </div>
  );
}

/**
 * Ruta `/admin/ventas`: venta de tiquetes en mostrador por un agente
 * comercial o administrador. Reutiliza el flujo de los pasajeros:
 *
 *   1. Vuelo   -> `ListaVuelos` (buscador con calendario de disponibilidad),
 *                 con `onSeleccionarVuelo` para no navegar fuera de esta vista.
 *   2. Asiento -> `PlanoCabina` (mismo plano en tiempo real). Seleccionar un
 *                 asiento crea el bloqueo temporal a nombre del agente, que
 *                 lo retiene mientras se llenan los datos; el backend lo
 *                 convierte en el tiquete del pasajero al confirmar.
 *   3. Pasajero -> formulario de datos personales; en lugar de tarjeta, el
 *                 pago se recibe en efectivo o datáfono en el mostrador.
 *
 * Al confirmar llama a `POST /api/admin/ventas` y muestra `BookingSuccess`
 * (con descarga de pase de abordar y factura) más la opción de iniciar
 * otra venta.
 */
function AdminVentasPage() {
  const [paso, setPaso] = useState('vuelo');
  const [vuelo, setVuelo] = useState(null);
  const [asiento, setAsiento] = useState(null);

  const [asientos, setAsientos] = useState([]);
  const [cargandoAsientos, setCargandoAsientos] = useState(false);
  const [errorAsientos, setErrorAsientos] = useState(null);

  const [pasajero, setPasajero] = useState(PASAJERO_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [errorVenta, setErrorVenta] = useState(null);
  const [venta, setVenta] = useState(null);

  // Carga el mapa de asientos al entrar al paso 2 (o al cambiar de vuelo).
  useEffect(() => {
    if (paso !== 'asiento' || !vuelo) return undefined;

    let cancelado = false;
    setCargandoAsientos(true);
    setErrorAsientos(null);

    listarAsientosPorVuelo(vuelo.idVuelo)
      .then((resultado) => {
        if (!cancelado) setAsientos(resultado);
      })
      .catch((err) => {
        if (!cancelado) setErrorAsientos(err.message);
      })
      .finally(() => {
        if (!cancelado) setCargandoAsientos(false);
      });

    return () => {
      cancelado = true;
    };
  }, [paso, vuelo]);

  const manejarSeleccionVuelo = useCallback((vueloElegido) => {
    setVuelo(vueloElegido);
    setAsiento(null);
    setPaso('asiento');
  }, []);

  const manejarAsientoBloqueado = useCallback(({ idAsiento, codigoAsiento }) => {
    setAsiento({ idAsiento, codigoAsiento });
  }, []);

  function volverAVuelos() {
    setVuelo(null);
    setAsiento(null);
    setErrorVenta(null);
    setPaso('vuelo');
  }

  function volverAAsientos() {
    setAsiento(null);
    setErrorVenta(null);
    setPaso('asiento');
  }

  function manejarCambioPasajero(evento) {
    const { name, value } = evento.target;
    setPasajero((previo) => ({ ...previo, [name]: value }));
  }

  async function manejarConfirmarVenta(evento) {
    evento.preventDefault();
    if (enviando || !vuelo || !asiento) return;

    setEnviando(true);
    setErrorVenta(null);
    try {
      const resultado = await registrarVentaAdmin({
        vueloId: vuelo.idVuelo,
        asientoId: asiento.idAsiento,
        pasajero,
      });
      setVenta(resultado);
      setPaso('exito');
    } catch (err) {
      setErrorVenta({ mensaje: err.message || MENSAJE_ERROR_VENTA, codigo: err.code });
    } finally {
      setEnviando(false);
    }
  }

  function iniciarNuevaVenta() {
    setVuelo(null);
    setAsiento(null);
    setPasajero(PASAJERO_INICIAL);
    setVenta(null);
    setErrorVenta(null);
    setPaso('vuelo');
  }

  if (paso === 'exito' && venta) {
    return (
      <div className="flex flex-col items-center gap-4">
        <BookingSuccess
          idTiquete={venta.tiquete.idTiquete}
          codigoReserva={venta.tiquete.codigoReserva}
          vuelo={vuelo.numeroVuelo}
          ruta={`${vuelo.origen} - ${vuelo.destino}`}
          fechaHora={formateadorFechaHora.format(new Date(vuelo.fechaHoraSalida))}
          asientos={asiento.codigoAsiento}
          descripcion={`Venta en mostrador registrada a nombre de ${pasajero.nombres} ${pasajero.apellidos}${
            venta.pasajeroCreado ? ' (pasajero nuevo)' : ''
          }.`}
        />
        <button
          type="button"
          onClick={iniciarNuevaVenta}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Registrar otra venta
        </button>
      </div>
    );
  }

  const indicePaso = PASOS.findIndex((item) => item.id === paso);
  const asientoTomadoPorOtro = errorVenta?.codigo === 'ASIENTO_NO_DISPONIBLE';

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Nueva Venta</h1>
        <p className="mt-1 text-sm text-slate-500">
          Venta en mostrador: el pago se recibe en efectivo o datáfono, sin tarjeta en línea.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {PASOS.map((item, indice) => (
            <div key={item.id} className="flex items-center gap-3">
              {indice > 0 && <span className="h-px w-8 bg-slate-200" />}
              <IndicadorPaso
                numero={indice + 1}
                titulo={item.titulo}
                activo={indice === indicePaso}
                completado={indice < indicePaso}
              />
            </div>
          ))}
        </div>
      </div>

      {paso === 'vuelo' && <ListaVuelos onSeleccionarVuelo={manejarSeleccionVuelo} />}

      {paso === 'asiento' && vuelo && (
        <>
          <ResumenSeleccion vuelo={vuelo} accion="Cambiar vuelo" onAccion={volverAVuelos} />

          {errorAsientos && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {errorAsientos}
            </div>
          )}

          {cargandoAsientos && <CabinaSkeleton />}

          {!cargandoAsientos && !errorAsientos && (
            <>
              <PlanoCabina
                key={vuelo.idVuelo}
                vueloId={vuelo.idVuelo}
                asientosIniciales={asientos}
                onAsientoBloqueado={manejarAsientoBloqueado}
              />
              <div className="flex flex-wrap items-center justify-end gap-4">
                {asiento && (
                  <p className="text-sm text-slate-600">
                    Asiento retenido: <strong>{asiento.codigoAsiento}</strong>
                  </p>
                )}
                <button
                  type="button"
                  disabled={!asiento}
                  onClick={() => setPaso('pasajero')}
                  className="rounded-lg bg-sky-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Continuar con el pasajero
                </button>
              </div>
            </>
          )}
        </>
      )}

      {paso === 'pasajero' && vuelo && asiento && (
        <>
          <ResumenSeleccion
            vuelo={vuelo}
            asiento={asiento}
            accion="Cambiar asiento"
            onAccion={volverAAsientos}
            deshabilitado={enviando}
          />

          <form onSubmit={manejarConfirmarVenta} className="flex flex-col gap-6">
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-800">Datos del pasajero</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <CampoTexto
                  id="documento"
                  etiqueta="Documento de identidad"
                  placeholder="CC 1020304050"
                  maxLength={30}
                  value={pasajero.documento}
                  onChange={manejarCambioPasajero}
                />
                <CampoTexto
                  id="correo"
                  etiqueta="Correo electrónico"
                  type="email"
                  placeholder="pasajero@correo.com"
                  value={pasajero.correo}
                  onChange={manejarCambioPasajero}
                />
                <CampoTexto
                  id="nombres"
                  etiqueta="Nombres"
                  placeholder="Juan Carlos"
                  maxLength={100}
                  value={pasajero.nombres}
                  onChange={manejarCambioPasajero}
                />
                <CampoTexto
                  id="apellidos"
                  etiqueta="Apellidos"
                  placeholder="Pérez Gómez"
                  maxLength={100}
                  value={pasajero.apellidos}
                  onChange={manejarCambioPasajero}
                />
                <CampoTexto
                  id="telefono"
                  etiqueta="Teléfono"
                  type="tel"
                  opcional
                  placeholder="+57 300 123 4567"
                  maxLength={20}
                  value={pasajero.telefono}
                  onChange={manejarCambioPasajero}
                />
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Si el documento ya está registrado, la venta se asocia a ese pasajero; si no, se crea
                su cuenta automáticamente.
              </p>
            </section>

            <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-6 shadow-sm">
              <div>
                <p className="text-sm text-slate-500">Total a cobrar en mostrador</p>
                <p className="text-2xl font-bold text-slate-800">
                  {formateadorMoneda.format(vuelo.precioBase)}
                </p>
                <p className="text-xs text-slate-400">Efectivo o datáfono (POS)</p>
              </div>
              <button
                type="submit"
                disabled={enviando}
                className="flex items-center gap-2 rounded-lg bg-sky-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {enviando && <Spinner />}
                {enviando ? 'Registrando venta...' : 'Confirmar venta'}
              </button>
            </section>

            {errorVenta && (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                <span>{errorVenta.mensaje}</span>
                {asientoTomadoPorOtro && (
                  <button
                    type="button"
                    onClick={volverAAsientos}
                    className="font-semibold underline hover:text-red-800"
                  >
                    Elegir otro asiento
                  </button>
                )}
              </div>
            )}
          </form>
        </>
      )}
    </div>
  );
}

export default AdminVentasPage;
