import { useState } from 'react';
import { obtenerFacturaPdf } from '../../services/documentosTiqueteApi.js';
import { descargarPdf } from '../../utils/descargarPdf.js';
import ToastAlerta from '../Cabina/ToastAlerta.jsx';

const MENSAJE_ERROR_GENERICO = 'No fue posible descargar la factura. Intenta nuevamente.';

const ESTILOS_POR_TAMANIO = {
  normal: 'px-4 py-3',
  compacto: 'px-3 py-1.5 text-sm',
};

/**
 * Botón compacto que descarga la factura en PDF de un tiquete
 * (`GET /api/tiquetes/:id/factura`), con su propio estado de carga y toast
 * de error. Lo usa el historial de viajes (una instancia por fila); la
 * vista de confirmación (`BookingSuccess`) maneja sus dos descargas
 * directamente.
 */
function DescargarFacturaButton({ tiqueteId, tamanio = 'normal', className = '' }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  async function manejarClick() {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await obtenerFacturaPdf(tiqueteId);
      descargarPdf(response, 'factura_skyroute.pdf');
    } catch (err) {
      setError(err.message || MENSAJE_ERROR_GENERICO);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={manejarClick}
        disabled={isLoading || !tiqueteId}
        aria-busy={isLoading}
        className={`rounded-lg border border-sky-600 font-semibold text-sky-600 transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 disabled:hover:bg-transparent ${ESTILOS_POR_TAMANIO[tamanio]} ${className}`}
      >
        {isLoading ? 'Generando factura...' : 'Descargar Factura en PDF'}
      </button>

      {error && <ToastAlerta mensaje={error} tipo="error" onCerrar={() => setError(null)} />}
    </>
  );
}

export default DescargarFacturaButton;
