import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

// TODO: reemplazar por el usuario autenticado real cuando exista login
// (mismo TODO que `USUARIO_ID_DEV` en App.jsx). Sin un sistema de auth no
// hay forma de obtener estos datos desde el navegador.
const USUARIO_DEV = {
  nombre: 'Laura Gómez',
};

/**
 * Envoltura del panel de pasajero: sidebar oscuro + topbar clara alrededor
 * del contenido de cada ruta hija (`<Outlet/>`). En móvil el sidebar es un
 * drawer que este componente controla (`sidebarAbierto`); en desktop
 * (`md:`) `Sidebar` lo fuerza a quedar fijo, así que el estado simplemente
 * queda sin uso ahí.
 */
function DashboardLayout() {
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  function manejarCerrarSesion() {
    // TODO: limpiar sesión/token real y navegar a /login cuando exista auth.
    console.log('Cerrando sesión...');
  }

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <Sidebar abierto={sidebarAbierto} onCerrar={() => setSidebarAbierto(false)} />

      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar
          nombreUsuario={USUARIO_DEV.nombre}
          onAbrirSidebar={() => setSidebarAbierto(true)}
          onCerrarSesion={manejarCerrarSesion}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
