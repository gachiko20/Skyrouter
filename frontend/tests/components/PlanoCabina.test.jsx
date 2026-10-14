import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlanoCabina from '../../src/components/Cabina/PlanoCabina.jsx';
import { AsientoNoDisponibleError, bloquearAsiento } from '../../src/services/asientosApi.js';

// No se usa jest.requireActual: el módulo real lee `import.meta.env`
// (sintaxis específica de Vite) que el transform de Babel/Jest no soporta.
jest.mock('../../src/services/asientosApi.js', () => {
  class AsientoNoDisponibleError extends Error {
    constructor(message) {
      super(message);
      this.name = 'AsientoNoDisponibleError';
    }
  }

  return {
    __esModule: true,
    AsientoNoDisponibleError,
    bloquearAsiento: jest.fn(),
  };
});

// Mismo motivo que el mock de `asientosApi.js` arriba (import.meta.env sin
// soporte en Jest/Babel): se reemplaza el módulo completo por un socket
// falso que no emite nada, para que las pruebas no abran una conexión de
// red real ni dependan del evento `asientos_actualizados` (eso se cubre en
// las pruebas de integración/manuales del WebSocket, no aquí).
jest.mock('../../src/services/socketClient.js', () => ({
  __esModule: true,
  EVENTO_UNIRSE_VUELO: 'unirse_vuelo',
  EVENTO_SALIR_VUELO: 'salir_vuelo',
  EVENTO_ASIENTOS_ACTUALIZADOS: 'asientos_actualizados',
  conectarSocket: jest.fn(() => ({
    emit: jest.fn(),
    on: jest.fn(),
    disconnect: jest.fn(),
  })),
}));

// SCRUM-49: `PlanoCabina` ya no recibe `usuarioId` por prop, lo lee de
// `AuthContext` (que a su vez depende de `authApi.js`/`httpClient.js`, y
// esos sí tocan `import.meta.env`). Se mockea el módulo completo para
// fijar un usuario de prueba sin arrastrar esa cadena de dependencias.
jest.mock('../../src/state/AuthContext.jsx', () => ({
  __esModule: true,
  useAuth: () => ({
    usuario: { idUsuario: 'usuario-1', nombreCompleto: 'Usuario Uno', rol: 'pasajero' },
  }),
}));

const ASIENTOS_INICIALES = [
  { idAsiento: 'asiento-1a', codigoAsiento: '1A', estado: 'DISPONIBLE' },
  { idAsiento: 'asiento-1b', codigoAsiento: '1B', estado: 'DISPONIBLE' },
  { idAsiento: 'asiento-1c', codigoAsiento: '1C', estado: 'OCUPADO' },
];

describe('PlanoCabina', () => {
  beforeEach(() => {
    bloquearAsiento.mockReset();
  });

  it('renderiza cada asiento con su estado inicial (disponible/ocupado)', () => {
    render(<PlanoCabina vueloId="vuelo-1" asientosIniciales={ASIENTOS_INICIALES} />);

    expect(screen.getByRole('button', { name: /asiento 1a, disponible/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /asiento 1c, ocupado/i })).toBeDisabled();
  });

  it('al bloquear con éxito, marca el asiento como BLOQUEADO_TEMPORAL y lo deshabilita', async () => {
    const usuario = userEvent.setup();
    bloquearAsiento.mockResolvedValueOnce({ idTiquete: 't-1', estado: 'PENDIENTE' });

    render(<PlanoCabina vueloId="vuelo-1" asientosIniciales={ASIENTOS_INICIALES} />);

    await usuario.click(screen.getByRole('button', { name: /asiento 1a, disponible/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /asiento 1a, bloqueado temporalmente/i })).toBeDisabled();
    });
    expect(bloquearAsiento).toHaveBeenCalledWith({ vueloId: 'vuelo-1', asientoId: 'asiento-1a', usuarioId: 'usuario-1' });
  });

  it('ante un 409, marca el asiento como OCUPADO y muestra una alerta sin romper el resto del plano', async () => {
    const usuario = userEvent.setup();
    bloquearAsiento.mockRejectedValueOnce(
      new AsientoNoDisponibleError('El asiento ya fue tomado, por favor selecciona otro.')
    );

    render(<PlanoCabina vueloId="vuelo-1" asientosIniciales={ASIENTOS_INICIALES} />);

    await usuario.click(screen.getByRole('button', { name: /asiento 1b, disponible/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /asiento 1b, ocupado/i })).toBeDisabled();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/el asiento ya fue tomado/i);

    // El resto del plano sigue interactivo: no se rompió el renderizado.
    expect(screen.getByRole('button', { name: /asiento 1c, ocupado/i })).toBeInTheDocument();
  });
});
