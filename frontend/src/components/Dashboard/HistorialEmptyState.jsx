/** Estado vacío mostrado cuando el usuario todavía no tiene tiquetes en su historial. */
function HistorialEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-100">
      <span className="text-4xl" aria-hidden="true">
        🧳
      </span>
      <p className="text-lg font-semibold text-slate-700">Todavía no tienes viajes reservados</p>
      <p className="text-sm text-slate-500">Cuando reserves un vuelo, aparecerá aquí tu historial.</p>
    </div>
  );
}

export default HistorialEmptyState;
