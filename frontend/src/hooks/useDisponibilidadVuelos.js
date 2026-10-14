import { useEffect, useState } from 'react';
import { obtenerDisponibilidadVuelos } from '../services/vuelosApi.js';

const FORMATO_IATA = /^[A-Z]{3}$/;

/**
 * Días con vuelos para una ruta, para resaltarlos en el calendario. Solo
 * consulta cuando origen y destino son códigos IATA completos (3 letras) y
 * distintos; mientras tanto devuelve una lista vacía sin tocar la red.
 * Si la ruta cambia antes de que llegue la respuesta anterior, esa
 * respuesta se descarta.
 *
 * @param {string} origen
 * @param {string} destino
 * @returns {{ fechas: string[], cargando: boolean, error: string | null, rutaCompleta: boolean }}
 */
export function useDisponibilidadVuelos(origen, destino) {
  const origenNormalizado = (origen || '').trim().toUpperCase();
  const destinoNormalizado = (destino || '').trim().toUpperCase();
  const rutaCompleta =
    FORMATO_IATA.test(origenNormalizado) &&
    FORMATO_IATA.test(destinoNormalizado) &&
    origenNormalizado !== destinoNormalizado;

  const [fechas, setFechas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!rutaCompleta) {
      setFechas([]);
      setCargando(false);
      setError(null);
      return undefined;
    }

    let cancelado = false;
    setCargando(true);
    setError(null);

    obtenerDisponibilidadVuelos({ origen: origenNormalizado, destino: destinoNormalizado })
      .then((resultado) => {
        if (!cancelado) setFechas(resultado);
      })
      .catch((err) => {
        if (cancelado) return;
        setFechas([]);
        setError(err.message || 'No fue posible consultar la disponibilidad.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [origenNormalizado, destinoNormalizado, rutaCompleta]);

  return { fechas, cargando, error, rutaCompleta };
}

export default useDisponibilidadVuelos;
