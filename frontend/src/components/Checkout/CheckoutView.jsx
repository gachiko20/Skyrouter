import { useState } from 'react';

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

/**
 * Vista de checkout de tiquetes. Mantiene el formulario en estado local;
 * la confirmación de pago aún no está conectada a la API (por ahora solo
 * registra los datos en consola).
 */
function CheckoutView() {
  const [formData, setFormData] = useState(ESTADO_INICIAL);

  function manejarCambio(evento) {
    const { name, value } = evento.target;
    setFormData((previo) => ({ ...previo, [name]: value }));
  }

  function manejarSubmit(evento) {
    evento.preventDefault();
    console.log('Datos de checkout:', formData);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="mb-6 text-2xl font-bold text-slate-800">Finalizar compra</h1>

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
            className="rounded-lg bg-sky-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-sky-700"
          >
            Confirmar y Pagar
          </button>
        </form>
      </div>
    </div>
  );
}

export default CheckoutView;
