import { Route, Routes } from 'react-router-dom';
import DashboardLayout from './components/Dashboard/DashboardLayout.jsx';
import ListaVuelos from './components/Vuelos/ListaVuelos.jsx';
import SeleccionAsientosPage from './components/Cabina/SeleccionAsientosPage.jsx';
import CheckoutView from './components/Checkout/CheckoutView.jsx';
import BookingSuccessPage from './components/Checkout/BookingSuccessPage.jsx';
import UserProfilePage from './components/Dashboard/UserProfilePage.jsx';
import FlightHistoryPage from './components/Dashboard/FlightHistoryPage.jsx';
import { ReservaProvider } from './state/ReservaContext.jsx';

// TODO: reemplazar por el usuario autenticado real cuando exista login.
// Sin un sistema de auth, no hay forma de obtener un `usuarioId` real desde
// el navegador; este valor de desarrollo debe apuntar a un `usuarios.id_usuario`
// existente en la base de datos para poder bloquear asientos/pagar en local.
const USUARIO_ID_DEV = import.meta.env.VITE_USUARIO_ID_DEV || null;

function App() {
  return (
    <ReservaProvider usuarioIdInicial={USUARIO_ID_DEV}>
      <Routes>
        {/* `DashboardLayout` envuelve toda la aplicación (sidebar + topbar
            tipo admin): búsqueda de vuelos, selección de asiento, checkout
            y éxito viven en el mismo shell que "Mi Perfil"/"Mis Viajes". */}
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<ListaVuelos />} />
          <Route path="/vuelos/:vueloId/asientos" element={<SeleccionAsientosPage />} />
          <Route path="/checkout" element={<CheckoutView />} />
          <Route path="/success" element={<BookingSuccessPage />} />
          <Route path="/perfil" element={<UserProfilePage />} />
          <Route path="/mis-viajes" element={<FlightHistoryPage />} />
        </Route>
      </Routes>
    </ReservaProvider>
  );
}

export default App;
