/**
 * Cabecera clara del panel de pasajero. Puramente presentacional: muestra
 * el nombre del usuario actual y delega "Cerrar sesión" al padre. El botón
 * de hamburguesa solo es visible en móvil (`md:hidden`) y abre el drawer
 * de `Sidebar`, que en desktop ya queda fijo.
 */
function Topbar({ nombreUsuario, onAbrirSidebar, onCerrarSesion }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onAbrirSidebar}
          aria-label="Abrir menú"
          className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
          </svg>
        </button>
        <p className="hidden text-sm font-medium text-slate-500 sm:block">Panel de pasajero</p>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-slate-800">{nombreUsuario}</span>
        <button
          type="button"
          onClick={onCerrarSesion}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M18 12H9m9 0-3-3m3 3-3 3"
            />
          </svg>
          <span className="hidden sm:inline">Cerrar sesión</span>
        </button>
      </div>
    </header>
  );
}

export default Topbar;
