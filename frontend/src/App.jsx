import { Route, Routes } from 'react-router-dom';
import DashboardLayout from './components/Dashboard/DashboardLayout.jsx';
import ListaVuelos from './components/Vuelos/ListaVuelos.jsx';
import SeleccionAsientosPage from './components/Cabina/SeleccionAsientosPage.jsx';
import CheckoutView from './components/Checkout/CheckoutView.jsx';
import BookingSuccessPage from './components/Checkout/BookingSuccessPage.jsx';
import UserProfilePage from './components/Dashboard/UserProfilePage.jsx';
import FlightHistoryPage from './components/Dashboard/FlightHistoryPage.jsx';
import LoginPage from './components/Auth/LoginPage.jsx';
import ProtectedRoute from './components/Auth/ProtectedRoute.jsx';
import AdminLayout from './components/Admin/AdminLayout.jsx';
import AdminDashboardPage from './components/Admin/AdminDashboardPage.jsx';
import AdminTiquetesPage from './components/Admin/AdminTiquetesPage.jsx';
import AdminVentasPage from './components/Admin/AdminVentasPage.jsx';
import { AuthProvider } from './state/AuthContext.jsx';
import { ReservaProvider } from './state/ReservaContext.jsx';
import { ROLES_ADMINISTRATIVOS } from './constants/roles.js';

function App() {
  return (
    <AuthProvider>
      <ReservaProvider>
        <Routes>
          {/* Pública: fuera de `DashboardLayout` (sin sidebar/topbar todavía). */}
          <Route path="/login" element={<LoginPage />} />

          {/* `DashboardLayout` exige sesión activa (redirige a /login si no
              hay token, ver su propio código) y envuelve todo lo demás:
              búsqueda de vuelos, selección de asiento, checkout y éxito
              viven en el mismo shell que "Mi Perfil"/"Mis Viajes". */}
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<ListaVuelos />} />
            <Route path="/vuelos/:vueloId/asientos" element={<SeleccionAsientosPage />} />
            <Route path="/checkout" element={<CheckoutView />} />
            <Route path="/success" element={<BookingSuccessPage />} />
            <Route path="/perfil" element={<UserProfilePage />} />
            <Route path="/mis-viajes" element={<FlightHistoryPage />} />
          </Route>

          {/* Zona administrativa: `ProtectedRoute` exige sesión + rol
              administrador/agente_comercial (muestra "Acceso denegado" en
              vez de redirigir en silencio si el rol no alcanza), y
              `AdminLayout` es el shell visual (sidebar/topbar) para lo que
              queda adentro.

              El prefijo "/admin" vive SOLO en este nodo externo; las rutas
              hijas usan paths relativos ("dashboard", "tiquetes"). Con dos
              niveles de layout route sin `path` propio (`ProtectedRoute` +
              `AdminLayout`), React Router no resuelve de forma fiable hijos
              con paths absolutos ("/admin/dashboard") — a diferencia del
              único nivel de anidación de `DashboardLayout` arriba, donde sí
              funciona. */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={ROLES_ADMINISTRATIVOS} />}>
            <Route element={<AdminLayout />}>
              <Route path="dashboard" element={<AdminDashboardPage />} />
              <Route path="tiquetes" element={<AdminTiquetesPage />} />
              <Route path="ventas" element={<AdminVentasPage />} />
            </Route>
          </Route>
        </Routes>
      </ReservaProvider>
    </AuthProvider>
  );
}

export default App;
