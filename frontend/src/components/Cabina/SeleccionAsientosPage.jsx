import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useReserva } from '../../state/ReservaContext.jsx';
import { listarAsientosPorVuelo } from '../../services/asientosApi.js';
import PlanoCabina from './PlanoCabina.jsx';
import CabinaSkeleton from './CabinaSkeleton.jsx';

const formateadorFechaHora = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'long',
  timeStyle: 'short',
});

/**
 * Página de selección de asientos (HU-02, SCRUM-8), destino de la
 * navegación disparada desde `VueloCard`/`ListaVuelos`.
 *
 * El vuelo seleccionado se lee de `ReservaContext` (guardado por
 * `ListaVuelos` al hacer clic en la tarjeta); `vueloId` en la URL queda
 * disponible para permitir recargar/compartir el enlace más adelante.
 */
function SeleccionAsientosPage() {
  const { vueloId } = useParams();
  const navigate = useNavigate();
  const { vuelo, asiento, seleccionarAsiento } = useReserva();

  const [asientos, setAsientos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;

    setIsLoading(true);
    setError(null);

    listarAsientosPorVuelo(vueloId)
      .then((resultado) => {
        if (!cancelado) setAsientos(resultado);
      })
      .catch((err) => {
        if (!cancelado) setError(err.message || 'No fue posible cargar el mapa de asientos.');
      })
      .finally(() => {
        if (!cancelado) setIsLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [vueloId]);

  function manejarAsientoBloqueado({ idAsiento, codigoAsiento }) {
    seleccionarAsiento({ idAsiento, codigoAsiento });
  }

  function manejarContinuarAlPago() {
    navigate('/checkout');
  }

  if (!vuelo || vuelo.idVuelo !== vueloId) {
    return (
      <div className="mx-auto max-w-md rounded-xl bg-white p-6 text-center shadow-sm">
        <p className="text-slate-700">
          No hay un vuelo seleccionado. Vuelve a la búsqueda y elige un vuelo para continuar.
        </p>
        <Link
          to="/"
          className="mt-4 inline-block rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-sky-700"
        >
          Volver a la búsqueda
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">Selecciona tu asiento</h1>
        <p className="mt-1 text-sm text-slate-500">
          Vuelo {vuelo.numeroVuelo} · {vuelo.origen} → {vuelo.destino} ·{' '}
          {formateadorFechaHora.format(new Date(vuelo.fechaHoraSalida))}
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {isLoading && <CabinaSkeleton />}

      {!isLoading && !error && (
        <>
          <PlanoCabina
            vueloId={vuelo.idVuelo}
            asientosIniciales={asientos}
            onAsientoBloqueado={manejarAsientoBloqueado}
          />

          <button
            type="button"
            disabled={!asiento}
            onClick={manejarContinuarAlPago}
            className="self-end rounded-lg bg-sky-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Continuar al pago
          </button>
        </>
      )}
    </div>
  );
}

export default SeleccionAsientosPage;
