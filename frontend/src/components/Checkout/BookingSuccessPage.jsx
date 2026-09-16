import { Navigate, useLocation } from 'react-router-dom';
import BookingSuccess from './BookingSuccess.jsx';

/**
 * Ruta `/success`. Envuelve `BookingSuccess` (puramente presentacional) con
 * los datos del tiquete que `CheckoutView` pasa vía `navigate('/success',
 * { state })` tras un pago confirmado. El estado global de la reserva
 * (`ReservaContext`) ya fue limpiado en ese punto, así que estos datos solo
 * viven en el `state` de la navegación, no en contexto.
 *
 * Si se entra a esta ruta sin ese `state` (recarga de página, URL directa),
 * no hay nada que mostrar: se redirige a la búsqueda de vuelos.
 */
function BookingSuccessPage() {
  const { state } = useLocation();

  if (!state?.codigoReserva) {
    return <Navigate to="/" replace />;
  }

  return (
    <BookingSuccess
      codigoReserva={state.codigoReserva}
      vuelo={state.vuelo}
      ruta={state.ruta}
      fechaHora={state.fechaHora}
      asientos={state.asientos}
    />
  );
}

export default BookingSuccessPage;
