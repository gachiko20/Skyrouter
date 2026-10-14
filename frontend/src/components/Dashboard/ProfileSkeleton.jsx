/** Placeholder animado con la silueta de la tarjeta de perfil, mostrado mientras isLoading es true. */
function ProfileSkeleton() {
  return (
    <section
      className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-100"
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <div className="h-20 w-20 shrink-0 animate-pulse rounded-full bg-slate-200" />

        <div className="flex flex-col items-center gap-2 sm:items-start">
          <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-slate-200" />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-lg bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-40 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
        </div>
      </div>
    </section>
  );
}

export default ProfileSkeleton;
