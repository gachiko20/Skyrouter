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
 */
function ReservaProvider({ children, usuarioIdInicial = null }) {
  const [usuarioId] = useState(usuarioIdInicial);
  const [vuelo, setVuelo] = useState(null);
  const [asiento, setAsiento] = useState(null);

  const value = useMemo(
    () => ({
      usuarioId,
      vuelo,
      asiento,
      seleccionarVuelo: setVuelo,
      seleccionarAsiento: setAsiento,
      limpiarSeleccion: () => {
        setVuelo(null);
        setAsiento(null);
      },
    }),
    [usuarioId, vuelo, asiento]
  );

  return <ReservaContext.Provider value={value}>{children}</ReservaContext.Provider>;
}

/** @returns {{usuarioId: string|null, vuelo: object|null, asiento: object|null, seleccionarVuelo: Function, seleccionarAsiento: Function, limpiarSeleccion: Function}} */
function useReserva() {
  const contexto = useContext(ReservaContext);
  if (!contexto) {
    throw new Error('useReserva debe usarse dentro de un <ReservaProvider>.');
  }
  return contexto;
}

export { ReservaProvider, useReserva };
