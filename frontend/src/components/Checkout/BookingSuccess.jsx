import { useState } from 'react';
import { obtenerFacturaPdf, obtenerPaseAbordarPdf } from '../../services/documentosTiqueteApi.js';
import { descargarPdf } from '../../utils/descargarPdf.js';
import ToastAlerta from '../Cabina/ToastAlerta.jsx';

const MENSAJE_ERROR_GENERICO = 'No fue posible descargar el documento. Intenta nuevamente.';

/**
 * Vista de confirmación tras un checkout exitoso. Recibe el resumen del
 * tiquete por props y descarga sus PDFs (pase de abordar y factura de
 * compra) desde `GET /api/tiquetes/:id/{pase-abordar,factura}`. El envío
 * por correo sigue delegado al padre (aún no conectado a la API real).
 */
function BookingSuccess({
  idTiquete,
  codigoReserva,
  vuelo,
  ruta,
  fechaHora,
  asientos,
  descripcion = 'Tu pago fue procesado exitosamente y tu tiquete ya está listo.',
  onEnviarCorreo = () => console.log('Enviando confirmación por correo...'),
}) {
  // 'pase' | 'factura' | null — una descarga a la vez, para no duplicar peticiones.
  const [descargando, setDescargando] = useState(null);
  const [error, setError] = useState(null);

  async function descargarDocumento(tipo, obtenerPdf, nombreArchivo) {
    if (descargando) return;

    setDescargando(tipo);
    setError(null);
    try {
      const response = await obtenerPdf(idTiquete);
      descargarPdf(response, nombreArchivo);
    } catch (err) {
      setError(err.message || MENSAJE_ERROR_GENERICO);
    } finally {
      setDescargando(null);
    }
  }

  function handleDescargarPase() {
    return descargarDocumento('pase', obtenerPaseAbordarPdf, `pase_abordar_${codigoReserva}.pdf`);
  }

  function handleDescargarFactura() {
    return descargarDocumento('factura', obtenerFacturaPdf, `factura_${codigoReserva}.pdf`);
  }

  const botonesDeshabilitados = Boolean(descargando) || !idTiquete;

  return (
    // Nota: sin `min-h-screen`/fondo propios a propósito — esta vista vive
    // dentro de `DashboardLayout` -> `<main>`, que ya aporta el alto
    // completo, el fondo y el padding de la página.
    <div className="mx-auto max-w-md px-4">
      <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-9 w-9 text-green-600"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>

            <h1 className="mt-4 text-2xl font-bold text-slate-800">¡Reserva confirmada!</h1>
            <p className="mt-1 text-sm text-slate-500">
              {descripcion}
            </p>
          </div>

          <dl className="mt-6 flex flex-col gap-3 rounded-lg bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <dt className="text-sm text-slate-500">Código de reserva</dt>
              <dd className="font-mono text-base font-bold tracking-wide text-slate-800">
                {codigoReserva}
              </dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="text-sm text-slate-500">Vuelo</dt>
              <dd className="text-sm font-medium text-slate-800">{vuelo}</dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="text-sm text-slate-500">Ruta</dt>
              <dd className="text-sm font-medium text-slate-800">{ruta}</dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="text-sm text-slate-500">Fecha y hora</dt>
              <dd className="text-sm font-medium text-slate-800">{fechaHora}</dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="text-sm text-slate-500">Asiento(s)</dt>
              <dd className="text-sm font-medium text-slate-800">{asientos}</dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="text-sm text-slate-500">Estado</dt>
              <dd>
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                  Confirmado
                </span>
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleDescargarPase}
              disabled={botonesDeshabilitados}
              aria-busy={descargando === 'pase'}
              className="rounded-lg bg-sky-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {descargando === 'pase' ? 'Generando pase...' : 'Descargar pase de abordar (PDF)'}
            </button>
            <button
              type="button"
              onClick={handleDescargarFactura}
              disabled={botonesDeshabilitados}
              aria-busy={descargando === 'factura'}
              className="rounded-lg border border-sky-600 px-4 py-3 font-semibold text-sky-600 transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 disabled:hover:bg-transparent"
            >
              {descargando === 'factura' ? 'Generando factura...' : 'Descargar Factura en PDF'}
            </button>
            <button
              type="button"
              onClick={onEnviarCorreo}
              className="rounded-lg border border-sky-600 px-4 py-3 font-semibold text-sky-600 transition-colors hover:bg-sky-50"
            >
              Enviar por correo
            </button>
          </div>
        </div>

        {error && <ToastAlerta mensaje={error} tipo="error" onCerrar={() => setError(null)} />}
      </div>
  );
}


export default BookingSuccess;
