const CANTIDAD_TARJETAS_ESTADO = 4;
const FILAS_SKELETON = 5;

/** Placeholder animado con la silueta del dashboard (tarjeta de ingresos + tarjetas de estado + tabla), mostrado mientras isLoading es true. */
function AdminDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-9 w-48 animate-pulse rounded bg-slate-200" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: CANTIDAD_TARJETAS_ESTADO }).map((_, indice) => (
          <div key={indice} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-7 w-12 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center gap-6 border-b border-slate-100 bg-slate-50 px-4 py-3">
          <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
          <div className="ml-auto h-3 w-24 animate-pulse rounded bg-slate-200" />
        </div>

        {Array.from({ length: FILAS_SKELETON }).map((_, fila) => (
          <div
            key={fila}
            className="flex items-center gap-6 border-b border-slate-100 px-4 py-4 last:border-b-0"
          >
            <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
            <div className="ml-auto h-4 w-28 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminDashboardSkeleton;
