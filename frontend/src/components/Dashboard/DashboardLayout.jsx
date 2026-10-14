import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import { useAuth } from '../../state/AuthContext.jsx';
import { ROLES_ADMINISTRATIVOS } from '../../constants/roles.js';

/** 'pasajero' -> 'Pasajero' (el backend guarda el rol en minúsculas; la UI lo muestra capitalizado). */
function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Shell de la aplicación completa (tipo admin/dashboard): sidebar oscuro +
 * topbar clara alrededor del contenido de cada ruta (`<Outlet/>`). Envuelve
 * TODAS las rutas protegidas de `App.jsx` — búsqueda de vuelos, selección
 * de asiento, checkout y éxito viven dentro de este shell igual que "Mi
 * Perfil" y "Mis Viajes", no solo estas dos últimas.
 *
 * También es el único punto que exige sesión activa (SCRUM-49): si no hay
 * usuario autenticado, redirige a `/login` guardando la ruta que se
 * intentaba visitar (`location.state.from`) para volver ahí después del
 * login exitoso.
 *
 * Además, es una guarda de ROL: este shell y sus rutas (buscador, checkout,
 * perfil, mis viajes) son exclusivamente del panel de PASAJERO. Si un
 * usuario con rol administrativo (administrador/agente_comercial) llega
 * aquí — por ejemplo, tecleando "/" directo en la URL —, se le redirige a
 * `/admin/tiquetes` en vez de dejarlo operar por error en vistas de
 * cliente. `ProtectedRoute` resuelve el caso simétrico (pasajero intentando
 * entrar a `/admin/*`).
 *
 * En móvil el sidebar es un drawer que este componente controla
 * (`sidebarAbierto`); en desktop (`md:`) `Sidebar` lo fuerza a quedar fijo,
 * así que el estado simplemente queda sin uso ahí.
 */
function DashboardLayout() {
  const { estaAutenticado, usuario, logout } = useAuth();
  const location = useLocation();
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  if (!estaAutenticado) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (ROLES_ADMINISTRATIVOS.includes(usuario.rol)) {
    return <Navigate to="/admin/tiquetes" replace />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      <Sidebar abierto={sidebarAbierto} onCerrar={() => setSidebarAbierto(false)} />

      {/* `min-w-0` es necesario para que un hijo ancho (ej. la tabla de
          historial, con su propio `overflow-x-auto`) no fuerce este
          flex-item a crecer y empuje al sidebar fuera de pantalla. */}
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

export default DashboardLayout;
