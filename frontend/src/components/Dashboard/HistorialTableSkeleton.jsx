const FILAS_SKELETON = 5;

/** Placeholder animado con la silueta de la tabla de historial, mostrado mientras isLoading es true. */
function HistorialTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100" aria-hidden="true">
      <div className="flex items-center gap-6 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
        <div className="ml-auto h-3 w-16 animate-pulse rounded bg-slate-200" />
      </div>

      {Array.from({ length: FILAS_SKELETON }).map((_, fila) => (
        <div
          key={fila}
          className="flex items-center gap-6 border-b border-slate-100 px-4 py-4 last:border-b-0"
        >
          <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-14 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-slate-200" />
          <div className="ml-auto h-8 w-24 animate-pulse rounded-lg bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

export default HistorialTableSkeleton;
