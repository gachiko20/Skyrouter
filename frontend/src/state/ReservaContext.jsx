import { createContext, useContext, useMemo, useState } from 'react';

const ReservaContext = createContext(null);

/**
 * Estado global de la reserva en curso (HU-02 -> Checkout): qué vuelo y qué
 * asiento seleccionó el pasajero en `PlanoCabina`, para que `CheckoutView`
 * pueda consumirlos sin tener que pasarlos por props a través de rutas.
 *
 * Se usa Context API (sin librerías externas) porque el proyecto no tiene
 * ninguna instalada (Redux/Zustand) y el estado a compartir es pequeño y de
 * un solo flujo lineal (seleccionar asiento -> pagar).
 *
 * El `usuarioId` NO vive aquí (SCRUM-49): ahora es un dato de sesión, no de
 * la reserva en curso, y vive en `AuthContext` — cualquier componente que lo
 * necesite debe usar `useAuth()` directamente.
 */
function ReservaProvider({ children }) {
  const [vuelo, setVuelo] = useState(null);
  const [asiento, setAsiento] = useState(null);

  const value = useMemo(
    () => ({
      vuelo,
      asiento,
      seleccionarVuelo: setVuelo,
      seleccionarAsiento: setAsiento,
      limpiarSeleccion: () => {
        setVuelo(null);
        setAsiento(null);
      },
    }),
    [vuelo, asiento]
  );

  return <ReservaContext.Provider value={value}>{children}</ReservaContext.Provider>;
}

/** @returns {{vuelo: object|null, asiento: object|null, seleccionarVuelo: Function, seleccionarAsiento: Function, limpiarSeleccion: Function}} */
function useReserva() {
  const contexto = useContext(ReservaContext);
  if (!contexto) {
    throw new Error('useReserva debe usarse dentro de un <ReservaProvider>.');
  }
  return contexto;
}

export { ReservaProvider, useReserva };
