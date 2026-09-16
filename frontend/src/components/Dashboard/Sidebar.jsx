import { NavLink } from 'react-router-dom';

const ENLACES = [
  {
    to: '/',
    etiqueta: 'Buscar Vuelos',
    icono: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    ),
  },
  {
    to: '/mis-viajes',
    etiqueta: 'Mis Viajes',
    icono: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z"
      />
    ),
  },
  {
    to: '/perfil',
    etiqueta: 'Mi Perfil',
    icono: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      />
    ),
  },
];

// Indicador de ruta activa estilo "admin dashboard": franja azul a la
// izquierda + fondo más claro, en vez del pill sólido anterior. El row
// inactivo lleva el mismo `border-l-4 border-transparent` (no `border-l-0`)
// para que el texto no "salte" 4px al activarse/desactivarse.
function claseEnlace({ isActive }) {
  return `flex items-center gap-3 border-l-4 px-4 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? 'border-blue-500 bg-slate-800 text-white'
      : 'border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
  }`;
}

/**
 * Navegación lateral del panel de pasajero. Puramente presentacional: la
 * lista de enlaces vive en `ENLACES` para que agregar una sección nueva no
 * toque el markup. En móvil actúa como un drawer controlado por
 * `DashboardLayout` (`abierto`/`onCerrar`); en desktop (`md:`) queda fija.
 */
function Sidebar({ abierto, onCerrar }) {
  return (
    <>
      {abierto && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 md:hidden"
          onClick={onCerrar}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-slate-900 transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-6 w-6 shrink-0 text-blue-400"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 12 3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12Zm0 0h7.5"
            />
          </svg>
          <span className="text-xl font-semibold text-white">SkyRoute</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 py-4">
          {ENLACES.map((enlace) => (
            <NavLink key={enlace.to} to={enlace.to} onClick={onCerrar} className={claseEnlace} end>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="h-5 w-5 shrink-0"
                aria-hidden="true"
              >
                {enlace.icono}
              </svg>
              {enlace.etiqueta}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;
