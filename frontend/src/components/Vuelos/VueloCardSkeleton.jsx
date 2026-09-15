/** Placeholder animado con la misma silueta de VueloCard, mostrado mientras isLoading es true. */
function VueloCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100" aria-hidden="true">
      <div className="mb-4 flex items-center justify-between">
        <div className="h-5 w-24 rounded bg-slate-200" />
        <div className="h-5 w-16 rounded-full bg-slate-200" />
      </div>
      <div className="mb-4 flex items-center justify-between">
        <div className="h-4 w-10 rounded bg-slate-200" />
        <div className="h-4 w-16 rounded bg-slate-200" />
        <div className="h-4 w-10 rounded bg-slate-200" />
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="h-4 w-28 rounded bg-slate-200" />
        <div className="h-5 w-20 rounded bg-slate-200" />
      </div>
    </div>
  );
}

export default VueloCardSkeleton;
