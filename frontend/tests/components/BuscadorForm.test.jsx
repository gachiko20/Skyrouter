import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BuscadorForm from '../../src/components/Vuelos/BuscadorForm.jsx';

describe('BuscadorForm', () => {
  it('se renderiza con los campos de búsqueda y el botón "Buscar" deshabilitado inicialmente', () => {
    render(<BuscadorForm onBuscar={jest.fn()} />);

    expect(screen.getByLabelText(/origen/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/destino/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fecha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /buscar/i })).toBeDisabled();
  });

  it('deshabilita "Buscar" y muestra un aviso cuando origen y destino son el mismo', async () => {
    const usuario = userEvent.setup();
    const onBuscar = jest.fn();
    render(<BuscadorForm onBuscar={onBuscar} />);

    await usuario.type(screen.getByLabelText(/origen/i), 'bog');
    await usuario.type(screen.getByLabelText(/destino/i), 'BOG');
    fireEvent.change(screen.getByLabelText(/fecha/i), { target: { value: '2030-01-01' } });

    const botonBuscar = screen.getByRole('button', { name: /buscar/i });
    expect(botonBuscar).toBeDisabled();
    expect(screen.getByText(/no pueden ser iguales/i)).toBeInTheDocument();

    fireEvent.click(botonBuscar);
    expect(onBuscar).not.toHaveBeenCalled();
  });

  it('habilita "Buscar" y ejecuta la búsqueda cuando origen y destino son distintos', async () => {
    const usuario = userEvent.setup();
    const onBuscar = jest.fn();
    render(<BuscadorForm onBuscar={onBuscar} />);

    await usuario.type(screen.getByLabelText(/origen/i), 'bog');
    await usuario.type(screen.getByLabelText(/destino/i), 'mde');
    fireEvent.change(screen.getByLabelText(/fecha/i), { target: { value: '2030-01-01' } });

    const botonBuscar = screen.getByRole('button', { name: /buscar/i });
    expect(botonBuscar).toBeEnabled();

    fireEvent.click(botonBuscar);
    expect(onBuscar).toHaveBeenCalledWith({ origen: 'BOG', destino: 'MDE', fecha: '2030-01-01' });
  });
});
