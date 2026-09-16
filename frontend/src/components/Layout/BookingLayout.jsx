import { Outlet } from 'react-router-dom';

/**
 * Envoltura del flujo de reserva (búsqueda -> selección de asiento ->
 * checkout -> éxito). Extraída de `App.jsx` para que este grupo de rutas
 * pueda convivir como hermano de `DashboardLayout` (que trae su propia
 * cabecera y sidebar) sin duplicar encabezados en `/perfil`.
 */
function BookingLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <h1 className="text-xl font-bold text-slate-800">Sky Rout Operations</h1>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

export default BookingLayout;
