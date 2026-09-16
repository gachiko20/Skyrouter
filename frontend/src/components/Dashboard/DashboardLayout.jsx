import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

// TODO: reemplazar por el usuario autenticado real cuando exista login
// (mismo TODO que `USUARIO_ID_DEV` en App.jsx). Sin un sistema de auth no
// hay forma de obtener estos datos desde el navegador.
const USUARIO_DEV = {
  nombre: 'Laura Gómez',
  rol: 'Pasajero',
};

/**
 * Shell de la aplicación completa (tipo admin/dashboard): sidebar oscuro +
 * topbar clara alrededor del contenido de cada ruta (`<Outlet/>`). Envuelve
 * TODAS las rutas de `App.jsx` — búsqueda de vuelos, selección de asiento,
 * checkout y éxito viven dentro de este shell igual que "Mi Perfil" y "Mis
 * Viajes", no solo estas dos últimas.
 *
 * En móvil el sidebar es un drawer que este componente controla
 * (`sidebarAbierto`); en desktop (`md:`) `Sidebar` lo fuerza a quedar fijo,
 * así que el estado simplemente queda sin uso ahí.
 */
function DashboardLayout() {
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  function manejarCerrarSesion() {
    // TODO: limpiar sesión/token real y navegar a /login cuando exista auth.
    console.log('Cerrando sesión...');
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      <Sidebar abierto={sidebarAbierto} onCerrar={() => setSidebarAbierto(false)} />

      {/* `min-w-0` es necesario para que un hijo ancho (ej. la tabla de
          historial, con su propio `overflow-x-auto`) no fuerce este
          flex-item a crecer y empuje al sidebar fuera de pantalla. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          nombreUsuario={USUARIO_DEV.nombre}
          rolUsuario={USUARIO_DEV.rol}
          onAbrirSidebar={() => setSidebarAbierto(true)}
          onCerrarSesion={manejarCerrarSesion}
        />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
