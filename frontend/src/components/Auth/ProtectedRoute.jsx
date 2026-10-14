import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../state/AuthContext.jsx';

/**
 * Guarda de ruta reutilizable: exige sesión activa y, si se pasa
 * `allowedRoles`, que el rol del usuario esté en esa lista. Se usa como
 * "layout route" (`<Route element={<ProtectedRoute allowedRoles={[...]} />}>`
 * envolviendo las rutas que protege), igual que ya hace `DashboardLayout`
 * con el panel de pasajero.
 *
 * - Sin sesión -> redirige a `/login`, guardando `location.state.from` para
 *   volver aquí después de iniciar sesión (mismo patrón que
 *   `DashboardLayout`).
 * - Con sesión pero rol no autorizado -> NO redirige en silencio (dejaría
 *   al usuario sin entender qué pasó): muestra un mensaje de acceso
 *   denegado con un enlace de vuelta a "/".
 * - Rol autorizado (o `allowedRoles` no se pasó) -> renderiza las rutas
 *   hijas (`<Outlet/>`).
 */
function ProtectedRoute({ allowedRoles }) {
  const { estaAutenticado, usuario } = useAuth();
  const location = useLocation();

  if (!estaAutenticado) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(usuario.rol)) {
    return <AccesoDenegado />;
  }

  return <Outlet />;
}

function AccesoDenegado() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
        <h1 className="text-xl font-bold text-slate-800">Acceso denegado</h1>
        <p className="mt-2 text-sm text-slate-500">
          No tienes permisos para ver esta sección.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-sky-700"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

export default ProtectedRoute;
