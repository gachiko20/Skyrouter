import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BuscadorForm from './BuscadorForm.jsx';
import VueloCard from './VueloCard.jsx';
import VueloCardSkeleton from './VueloCardSkeleton.jsx';
import EmptyState from './EmptyState.jsx';
import { buscarVuelos } from '../../services/vuelosApi.js';
import { useReserva } from '../../state/ReservaContext.jsx';

const CANTIDAD_SKELETONS = 6;

/**
 * Orquesta el flujo completo de búsqueda (estado de carga, error y
 * resultados). Es el único componente de esta feature que conoce la capa
 * de red; BuscadorForm y VueloCard permanecen puramente presentacionales.
 */
function ListaVuelos() {
  const [vuelos, setVuelos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [yaBusco, setYaBusco] = useState(false);

  const navigate = useNavigate();
  const { seleccionarVuelo } = useReserva();

  const manejarSeleccionVuelo = useCallback(
    (vuelo) => {
      // Estado global (consumido más adelante por CheckoutView) + state de
      // navegación como respaldo, por si se recarga la página de destino.
      seleccionarVuelo(vuelo);
      navigate(`/vuelos/${vuelo.idVuelo}/asientos`, { state: { vuelo } });
    },
    [seleccionarVuelo, navigate]
  );

  const manejarBusqueda = useCallback(async (criterios) => {
    setIsLoading(true);
    setError(null);
    try {
      const resultado = await buscarVuelos(criterios);
      setVuelos(resultado);
    } catch (errorBusqueda) {
      setError(errorBusqueda.message || 'Ocurrió un error al buscar vuelos.');
      setVuelos([]);
    } finally {
      setIsLoading(false);
      setYaBusco(true);
    }
  }, []);

  const mostrarVacio = !isLoading && yaBusco && !error && vuelos.length === 0;
  const mostrarResultados = !isLoading && vuelos.length > 0;

  return (
    <section className="flex flex-col gap-6">
      <BuscadorForm onBuscar={manejarBusqueda} isLoading={isLoading} />

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: CANTIDAD_SKELETONS }).map((_, indice) => (
            <VueloCardSkeleton key={indice} />
          ))}
        </div>
      )}

      {mostrarVacio && <EmptyState />}

      {mostrarResultados && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vuelos.map((vuelo) => (
            <VueloCard key={vuelo.idVuelo} vuelo={vuelo} onSeleccionar={manejarSeleccionVuelo} />
          ))}
        </div>
      )}
    </section>
  );
}

export default ListaVuelos;
