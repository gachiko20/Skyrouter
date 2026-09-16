import { useState } from 'react';

/** Iniciales del usuario para el avatar circular (ej. "Laura Gómez" -> "LG"). */
function obtenerIniciales(nombre) {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra[0].toUpperCase())
    .join('');
}

/**
 * Cabecera clara del panel de pasajero. Todo el contenido relevante va
 * alineado a la derecha (campana de notificaciones + zona de usuario); el
 * botón de hamburguesa a la izquierda solo existe para abrir el drawer de
 * `Sidebar` en móvil (`md:hidden`), en desktop el sidebar ya queda fijo.
 *
 * La zona de usuario (avatar + nombre/rol + flecha) es un botón que abre
 * un menú desplegable con "Cerrar sesión" — la flecha hacia abajo no tiene
 * sentido como adorno puro, y este es el único lugar donde queda esa
 * acción ahora que el topbar no expone un botón de logout visible todo el
 * tiempo.
 */
function Topbar({ nombreUsuario, rolUsuario, onAbrirSidebar, onCerrarSesion }) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  function manejarCerrarSesion() {
    setMenuAbierto(false);
    onCerrarSesion();
  }

  return (
    <header className="relative flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
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

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label="Notificaciones"
          className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
            />
          </svg>
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
        </button>

        <div className="h-8 w-px bg-slate-200" aria-hidden="true" />

        <button
          type="button"
          onClick={() => setMenuAbierto((abierto) => !abierto)}
          aria-haspopup="true"
          aria-expanded={menuAbierto}
          className="flex items-center gap-2 rounded-lg p-1.5 text-left transition-colors hover:bg-slate-100"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">
            {obtenerIniciales(nombreUsuario)}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-tight text-slate-800">{nombreUsuario}</p>
            <p className="text-xs leading-tight text-slate-500">{rolUsuario}</p>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${menuAbierto ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>

      {menuAbierto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setMenuAbierto(false)} aria-hidden="true" />
          <div className="absolute right-4 top-14 z-40 w-48 overflow-hidden rounded-lg bg-white py-1 shadow-lg ring-1 ring-slate-200 sm:right-6">
            <button
              type="button"
              onClick={manejarCerrarSesion}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
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
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </header>
  );
}

export default Topbar;
