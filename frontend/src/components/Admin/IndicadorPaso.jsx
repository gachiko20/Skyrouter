/**
 * Paso numerado de un flujo por etapas (círculo + título): azul si es el
 * paso actual, verde con ✓ si ya se completó, gris si está pendiente.
 * Lo comparten `ReagendarTiqueteModal` y `AdminVentasPage`.
 */
function IndicadorPaso({ numero, titulo, activo, completado }) {
  let estilos = 'bg-slate-100 text-slate-400';
  if (activo) estilos = 'bg-sky-600 text-white';
  else if (completado) estilos = 'bg-green-100 text-green-700';

  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${estilos}`}
      >
        {completado && !activo ? '✓' : numero}
      </span>
      <span className={`text-sm font-medium ${activo ? 'text-slate-800' : 'text-slate-500'}`}>
        {titulo}
      </span>
    </div>
  );
}

export default IndicadorPaso;
