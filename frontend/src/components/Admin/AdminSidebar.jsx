import { NavLink } from 'react-router-dom';

const ENLACES = [
  {
    to: '/admin/dashboard',
    etiqueta: 'Dashboard',
    icono: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
      />
    ),
  },
  {
    to: '/admin/tiquetes',
    etiqueta: 'Gestión de Tiquetes',
    icono: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z"
      />
    ),
  },
  {
    to: '/admin/ventas',
    etiqueta: 'Nueva Venta',
    icono: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    ),
  },
];

// Mismo indicador de ruta activa que el `Sidebar` de pasajero, pero en
// ámbar en vez de azul: distingue a simple vista que se está en la zona
// administrativa.
function claseEnlace({ isActive }) {
  return `flex items-center gap-3 border-l-4 px-4 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? 'border-amber-500 bg-slate-800 text-white'
      : 'border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
  }`;
}

/**
 * Navegación lateral de la zona administrativa: "Dashboard", "Gestión de
 * Tiquetes" y "Nueva Venta", distinta de `Dashboard/Sidebar.jsx` (panel de pasajero). Mismo
 * comportamiento de drawer en móvil / fijo en desktop, controlado por
 * `AdminLayout` (`abierto`/`onCerrar`).
 *
 * Es una copia deliberada de la estructura de `Sidebar.jsx` con su propio
 * contenido, no una variante parametrizada de un componente compartido:
 * con solo 2 sidebars en todo el proyecto, generalizarlas sería una
 * abstracción prematura.
 */
function AdminSidebar({ abierto, onCerrar }) {
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
        <div className="flex h-16 flex-col justify-center gap-0.5 border-b border-slate-800 px-6">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              className="h-6 w-6 shrink-0 text-amber-400"
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
          <span className="pl-8 text-xs font-medium uppercase tracking-wide text-slate-400">
            Panel administrativo
          </span>
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

export default AdminSidebar;
