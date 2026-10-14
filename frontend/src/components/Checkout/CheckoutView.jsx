import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReserva } from '../../state/ReservaContext.jsx';
import { useAuth } from '../../state/AuthContext.jsx';
import { confirmarCheckout } from '../../services/checkoutApi.js';
import ToastAlerta from '../Cabina/ToastAlerta.jsx';

const ESTADO_INICIAL = {
  nombreCompleto: '',
  correo: '',
  telefono: '',
  pasaporte: '',
  numeroTarjeta: '',
  fechaExpiracion: '',
  cvv: '',
  nombreTitular: '',
};

const MENSAJE_SIN_SELECCION = 'Selecciona un vuelo y un asiento antes de continuar con el pago.';
const MENSAJE_ERROR_GENERICO = 'No fue posible procesar el pago. Intenta nuevamente.';

const formateadorFechaHora = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'long',
  timeStyle: 'short',
});

/**
 * Vista de checkout de tiquetes. Consume el vuelo/asiento seleccionados en
 * HU-02 desde `ReservaContext` (estado global) y envía el pago simulado a
 * `POST /api/tiquetes/checkout`. Al confirmar, limpia la selección en curso
 * y navega a `/success` con los datos del tiquete en el `state` de la ruta.
 */
function CheckoutView() {
  const { vuelo, asiento, limpiarSeleccion } = useReserva();
  const { usuario } = useAuth();
  const usuarioId = usuario.idUsuario;
  const navigate = useNavigate();
  const [formData, setFormData] = useState(ESTADO_INICIAL);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  function manejarCambio(evento) {
    const { name, value } = evento.target;
    setFormData((previo) => ({ ...previo, [name]: value }));
  }

  async function manejarSubmit(evento) {
    evento.preventDefault();
    if (isLoading) return;

    if (!vuelo || !asiento || !usuarioId) {
      setError(MENSAJE_SIN_SELECCION);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const tiquete = await confirmarCheckout({
        vueloId: vuelo.idVuelo,
        asientoId: asiento.idAsiento,
        pasajeroId: usuarioId,
        datosPasajero: {
          nombreCompleto: formData.nombreCompleto,
          correo: formData.correo,
          telefono: formData.telefono,
          pasaporte: formData.pasaporte,
        },
        datosPago: {
          numeroTarjeta: formData.numeroTarjeta,
          fechaExpiracion: formData.fechaExpiracion,
          cvv: formData.cvv,
          nombreTitular: formData.nombreTitular,
        },
      });
      const datosExito = {
        idTiquete: tiquete.idTiquete,
        codigoReserva: tiquete.codigoReserva,
        vuelo: vuelo.numeroVuelo,
        ruta: `${vuelo.origen} - ${vuelo.destino}`,
        fechaHora: formateadorFechaHora.format(new Date(vuelo.fechaHoraSalida)),
        asientos: asiento.codigoAsiento,
      };
      limpiarSeleccion();
      navigate('/success', { state: datosExito });
    } catch (err) {
      setError(err.message || MENSAJE_ERROR_GENERICO);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    // Nota: sin `min-h-screen`/fondo propios a propósito — esta vista vive
    // dentro de `DashboardLayout` -> `<main>`, que ya aporta el alto
    // completo, el fondo y el padding de la página.
    <>
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="mb-6 text-2xl font-bold text-slate-800">Finalizar compra</h1>

        {vuelo && asiento && (
          <p className="mb-6 -mt-4 text-sm text-slate-500">
            Vuelo {vuelo.numeroVuelo} · {vuelo.origen} - {vuelo.destino} · Asiento {asiento.codigoAsiento}
          </p>
        )}

        <form onSubmit={manejarSubmit} className="flex flex-col gap-6">
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Detalle del pasajero</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="nombreCompleto" className="text-sm font-medium text-slate-700">
                  Nombre completo
                </label>
                <input
                  id="nombreCompleto"
                  name="nombreCompleto"
                  type="text"
                  required
                  placeholder="Juan Pérez"
                  value={formData.nombreCompleto}
                  onChange={manejarCambio}
                  className="rounded-lg border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="correo" className="text-sm font-medium text-slate-700">
                  Correo electrónico
                </label>
                <input
                  id="correo"
                  name="correo"
                  type="email"
                  required
                  placeholder="juan.perez@correo.com"
                  value={formData.correo}
                  onChange={manejarCambio}
                  className="rounded-lg border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="telefono" className="text-sm font-medium text-slate-700">
                  Teléfono
                </label>
                <input
                  id="telefono"
                  name="telefono"
                  type="tel"
                  required
                  placeholder="+57 300 123 4567"
                  value={formData.telefono}
                  onChange={manejarCambio}
                  className="rounded-lg border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="pasaporte" className="text-sm font-medium text-slate-700">
                  Número de pasaporte
                </label>
                <input
                  id="pasaporte"
                  name="pasaporte"
                  type="text"
                  required
                  placeholder="AB123456"
                  value={formData.pasaporte}
                  onChange={manejarCambio}
                  className="rounded-lg border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Método de pago</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label htmlFor="numeroTarjeta" className="text-sm font-medium text-slate-700">
                  Número de tarjeta
                </label>
                <input
                  id="numeroTarjeta"
                  name="numeroTarjeta"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9\s]{13,19}"
                  required
                  placeholder="1234 5678 9012 3456"
                  value={formData.numeroTarjeta}
                  onChange={manejarCambio}
                  className="rounded-lg border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="fechaExpiracion" className="text-sm font-medium text-slate-700">
                  Fecha de expiración (MM/AA)
                </label>
                <input
                  id="fechaExpiracion"
                  name="fechaExpiracion"
                  type="text"
                  inputMode="numeric"
                  pattern="(0[1-9]|1[0-2])\/[0-9]{2}"
                  required
                  placeholder="MM/AA"
                  value={formData.fechaExpiracion}
                  onChange={manejarCambio}
                  className="rounded-lg border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="cvv" className="text-sm font-medium text-slate-700">
                  CVV
                </label>
                <input
                  id="cvv"
                  name="cvv"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{3,4}"
                  required
                  placeholder="123"
                  value={formData.cvv}
                  onChange={manejarCambio}
                  className="rounded-lg border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="flex flex-col gap-1 sm:col-span-2">
                <label htmlFor="nombreTitular" className="text-sm font-medium text-slate-700">
                  Nombre del titular
                </label>
                <input
                  id="nombreTitular"
                  name="nombreTitular"
                  type="text"
                  required
                  placeholder="Juan Pérez"
                  value={formData.nombreTitular}
                  onChange={manejarCambio}
                  className="rounded-lg border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>
          </section>

          <button
            type="submit"
            disabled={isLoading}
            className="rounded-lg bg-sky-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isLoading ? 'Procesando pago...' : 'Confirmar y Pagar'}
          </button>
        </form>
      </div>

      {error && <ToastAlerta mensaje={error} tipo="error" onCerrar={() => setError(null)} />}
    </>
  );
}

export default CheckoutView;
