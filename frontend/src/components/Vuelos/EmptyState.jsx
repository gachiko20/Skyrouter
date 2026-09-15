/** Estado vacío mostrado cuando una búsqueda no arroja resultados. */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-100">
      <span className="text-4xl" aria-hidden="true">
        🛫
      </span>
      <p className="text-lg font-semibold text-slate-700">No encontramos vuelos disponibles</p>
      <p className="text-sm text-slate-500">Intenta con otra fecha u otra ruta.</p>
    </div>
  );
}

export default EmptyState;
