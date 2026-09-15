import { useEffect } from 'react';

const ESTILOS_POR_TIPO = {
  error: 'bg-red-600',
  info: 'bg-slate-800',
};

const DURACION_MS = 4000;

/**
 * Alerta flotante no bloqueante (ej. "el asiento ya fue tomado"). Se
 * autodestruye tras `DURACION_MS`; el padre solo necesita limpiar su
 * estado en `onCerrar` cuando eso ocurre.
 */
function ToastAlerta({ mensaje, tipo = 'error', onCerrar }) {
  useEffect(() => {
    const temporizador = setTimeout(onCerrar, DURACION_MS);
    return () => clearTimeout(temporizador);
  }, [mensaje, onCerrar]);

  if (!mensaje) return null;

  return (
    <div
      role="alert"
      className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${ESTILOS_POR_TIPO[tipo]}`}
    >
      {mensaje}
    </div>
  );
}

export default ToastAlerta;
