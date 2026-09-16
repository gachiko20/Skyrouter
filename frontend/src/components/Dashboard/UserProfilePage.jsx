import { useRef, useState } from 'react';

// TODO: reemplazar por el usuario autenticado real cuando exista login y un
// endpoint de perfil (GET /api/usuarios/:id). Mismo TODO que
// `USUARIO_ID_DEV` en App.jsx / `USUARIO_DEV` en DashboardLayout.
const USUARIO = {
  nombre: 'Laura Gómez',
  rol: 'Pasajero',
  correo: 'laura.gomez@correo.com',
  telefono: '+57 300 123 4567',
};

const ESTADO_INICIAL_PASSWORD = {
  actual: '',
  nueva: '',
  confirmar: '',
};

const MENSAJE_CONTRASENAS_DISTINTAS = 'Las contraseñas no coinciden.';
const PATRON_CONTRASENA = '(?=.*[A-Za-z])(?=.*\\d).{8,}';

function obtenerIniciales(nombre) {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra[0].toUpperCase())
    .join('');
}

/**
 * Ruta `/perfil`, montada dentro de `DashboardLayout`. Igual que
 * `CheckoutView`, es la única responsable de su formulario: guarda el
 * estado de los campos y valida en el propio input. Sin endpoint de perfil
 * todavía (`USUARIO` es un mock), así que "Cambiar contraseña" se queda en
 * un `console.log` en vez de llamar a la API.
 */
function UserProfilePage() {
  const [formPassword, setFormPassword] = useState(ESTADO_INICIAL_PASSWORD);
  const confirmarRef = useRef(null);

  function validarCoincidencia(nueva, confirmar) {
    if (!confirmarRef.current) return;
    confirmarRef.current.setCustomValidity(
      confirmar && confirmar !== nueva ? MENSAJE_CONTRASENAS_DISTINTAS : ''
    );
  }

  function manejarCambioPassword(evento) {
    const { name, value } = evento.target;
    setFormPassword((previo) => {
      const siguiente = { ...previo, [name]: value };
      // La coincidencia depende de dos campos, así que se revalida aquí
      // (tanto al tocar "nueva" como "confirmar") en vez de solo en blur.
      if (name === 'nueva' || name === 'confirmar') {
        validarCoincidencia(siguiente.nueva, siguiente.confirmar);
      }
      return siguiente;
    });
  }

  function manejarSubmitPassword(evento) {
    evento.preventDefault();
    console.log('Cambiar contraseña:', formPassword);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-800">Mi Perfil</h1>

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-sky-600 text-2xl font-bold text-white">
            {obtenerIniciales(USUARIO.nombre)}
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-lg font-bold text-slate-800">{USUARIO.nombre}</p>
            <span className="inline-flex w-fit self-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700 sm:self-start">
              {USUARIO.rol}
            </span>
          </div>
        </div>

        <dl className="mt-6 flex flex-col gap-3 rounded-lg bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-slate-500">Correo electrónico</dt>
            <dd className="text-sm font-medium text-slate-800">{USUARIO.correo}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-slate-500">Teléfono</dt>
            <dd className="text-sm font-medium text-slate-800">{USUARIO.telefono}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Cambiar contraseña</h2>

        <form onSubmit={manejarSubmitPassword} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="actual" className="text-sm font-medium text-slate-700">
              Contraseña actual
            </label>
            <input
              id="actual"
              name="actual"
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
              value={formPassword.actual}
              onChange={manejarCambioPassword}
              className="rounded-lg border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="nueva" className="text-sm font-medium text-slate-700">
                Nueva contraseña
              </label>
              <input
                id="nueva"
                name="nueva"
                type="password"
                required
                minLength={8}
                pattern={PATRON_CONTRASENA}
                title="Mínimo 8 caracteres, incluyendo letras y números."
                autoComplete="new-password"
                value={formPassword.nueva}
                onChange={manejarCambioPassword}
                className="rounded-lg border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="confirmar" className="text-sm font-medium text-slate-700">
                Confirmar nueva contraseña
              </label>
              <input
                id="confirmar"
                name="confirmar"
                ref={confirmarRef}
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={formPassword.confirmar}
                onChange={manejarCambioPassword}
                className="rounded-lg border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="self-start rounded-lg bg-sky-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-sky-700"
          >
            Actualizar contraseña
          </button>
        </form>
      </section>
    </div>
  );
}

export default UserProfilePage;
