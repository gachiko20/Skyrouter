/** Placeholder animado con la silueta del plano de cabina, mostrado mientras isLoading es true. */
function CabinaSkeleton() {
  return (
    <div
      className="flex flex-col items-center gap-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-100"
      aria-hidden="true"
    >
      <div className="h-3 w-64 animate-pulse rounded bg-slate-200" />

      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, fila) => (
          <div key={fila} className="flex items-center gap-2">
            <div className="h-3 w-6 shrink-0 animate-pulse rounded bg-slate-200" />
            {Array.from({ length: 4 }).map((_, columna) => (
              <div key={columna} className="h-10 w-10 shrink-0 animate-pulse rounded-md bg-slate-200" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CabinaSkeleton;
