import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar.jsx';
import Topbar from '../Dashboard/Topbar.jsx';
import { useAuth } from '../../state/AuthContext.jsx';

/** 'administrador' -> 'Administrador' (el backend guarda el rol en minúsculas; la UI lo muestra capitalizado). */
function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Shell de la zona administrativa: mismo patrón visual que
 * `Dashboard/DashboardLayout.jsx` (sidebar + topbar alrededor de
 * `<Outlet/>`, con el mismo `Topbar` reutilizado tal cual), pero con
 * `AdminSidebar` en vez del `Sidebar` de pasajero.
 *
 * A propósito NO verifica sesión ni rol por sí mismo: esa es
 * responsabilidad exclusiva de `ProtectedRoute` (ver `App.jsx`), que debe
 * envolver cualquier grupo de rutas que use este layout. Separar ambas
 * cosas evita duplicar la lógica de guardia en cada layout nuevo que se
 * agregue — a diferencia de `DashboardLayout`, que todavía trae su propio
 * chequeo de sesión porque se escribió antes de que `ProtectedRoute`
 * existiera.
 */
function AdminLayout() {
  const { usuario, logout } = useAuth();
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      <AdminSidebar abierto={sidebarAbierto} onCerrar={() => setSidebarAbierto(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          nombreUsuario={usuario.nombreCompleto}
          rolUsuario={capitalizar(usuario.rol)}
          onAbrirSidebar={() => setSidebarAbierto(true)}
          onCerrarSesion={logout}
        />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
