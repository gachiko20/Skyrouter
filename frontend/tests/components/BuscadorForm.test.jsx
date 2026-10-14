import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BuscadorForm from '../../src/components/Vuelos/BuscadorForm.jsx';
import { obtenerDisponibilidadVuelos } from '../../src/services/vuelosApi.js';

// La disponibilidad del calendario es la única llamada de red del
// formulario: se simula para no depender del backend. Una fecha lejana
// fija hace que el calendario abra en un mes determinista (enero 2030).
jest.mock('../../src/services/vuelosApi.js', () => ({
  obtenerDisponibilidadVuelos: jest.fn(),
}));

const FECHA_CON_VUELOS = '2030-01-15';

/** Abre el calendario y elige el 15 de enero de 2030 (día resaltado). */
async function elegirFechaConVuelos(usuario) {
  await usuario.click(screen.getByLabelText(/fecha/i));
  const dia = await screen.findByRole('button', { name: /15 de enero de 2030/i });
  await usuario.click(dia);
}

describe('BuscadorForm', () => {
  beforeEach(() => {
    obtenerDisponibilidadVuelos.mockReset();
    obtenerDisponibilidadVuelos.mockResolvedValue([FECHA_CON_VUELOS]);
  });

  it('se renderiza con los campos de búsqueda y el botón "Buscar" deshabilitado inicialmente', () => {
    render(<BuscadorForm onBuscar={jest.fn()} />);

    expect(screen.getByLabelText(/origen/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/destino/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fecha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /buscar/i })).toBeDisabled();
    expect(obtenerDisponibilidadVuelos).not.toHaveBeenCalled();
  });

  it('consulta la disponibilidad al completar origen y destino y resalta esos días', async () => {
    const usuario = userEvent.setup();
    render(<BuscadorForm onBuscar={jest.fn()} />);

    await usuario.type(screen.getByLabelText(/origen/i), 'bog');
    await usuario.type(screen.getByLabelText(/destino/i), 'mde');

    await waitFor(() =>
      expect(obtenerDisponibilidadVuelos).toHaveBeenCalledWith({ origen: 'BOG', destino: 'MDE' })
    );
    // Solo una vez: no se consulta con rutas incompletas ("B", "BO", ...).
    expect(obtenerDisponibilidadVuelos).toHaveBeenCalledTimes(1);

    await usuario.click(screen.getByLabelText(/fecha/i));
    const dia = await screen.findByRole('button', { name: /15 de enero de 2030/i });
    expect(dia.closest('td').className).toMatch(/emerald/);
  });

  it('deshabilita "Buscar" y muestra un aviso cuando origen y destino son el mismo', async () => {
    const usuario = userEvent.setup();
    const onBuscar = jest.fn();
    render(<BuscadorForm onBuscar={onBuscar} />);

    await usuario.type(screen.getByLabelText(/origen/i), 'bog');
    await usuario.type(screen.getByLabelText(/destino/i), 'BOG');

    const botonBuscar = screen.getByRole('button', { name: /^buscar$/i });
    expect(botonBuscar).toBeDisabled();
    expect(screen.getByText(/no pueden ser iguales/i)).toBeInTheDocument();
    expect(obtenerDisponibilidadVuelos).not.toHaveBeenCalled();

    fireEvent.click(botonBuscar);
    expect(onBuscar).not.toHaveBeenCalled();
  });

  it('habilita "Buscar" y ejecuta la búsqueda cuando origen y destino son distintos', async () => {
    const usuario = userEvent.setup();
    const onBuscar = jest.fn();
    render(<BuscadorForm onBuscar={onBuscar} />);

    await usuario.type(screen.getByLabelText(/origen/i), 'bog');
    await usuario.type(screen.getByLabelText(/destino/i), 'mde');
    await waitFor(() => expect(obtenerDisponibilidadVuelos).toHaveBeenCalled());
    await elegirFechaConVuelos(usuario);

    const botonBuscar = screen.getByRole('button', { name: /^buscar$/i });
    expect(botonBuscar).toBeEnabled();

    fireEvent.click(botonBuscar);
    expect(onBuscar).toHaveBeenCalledWith({ origen: 'BOG', destino: 'MDE', fecha: FECHA_CON_VUELOS });
  });
});
