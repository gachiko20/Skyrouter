import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../state/AuthContext.jsx';
import { calcularDestinoPostLogin } from '../../constants/roles.js';

const MENSAJE_ERROR_GENERICO = 'No fue posible iniciar sesión. Intenta nuevamente.';

/**
 * Ruta pública `/login`. Fuera de `DashboardLayout`/`AdminLayout` a
 * propósito: antes de autenticarse no hay sidebar/topbar que mostrar.
 *
 * Si ya hay sesión activa, redirige de inmediato (evita que alguien
 * autenticado vea el formulario de login). Al autenticarse (o si ya estaba
 * autenticado), vuelve a la ruta que el usuario intentaba visitar
 * originalmente (`location.state.from`, puesto por `DashboardLayout`/
 * `ProtectedRoute` al redirigir aquí) — pero solo si esa ruta es compatible
 * con el rol de quien efectivamente inició sesión (`calcularDestinoPostLogin`):
 * un `from` de una sesión anterior con otro rol no debe colarse a esta. Si
 * no hay `from` válido (llegó directo a /login, o el que había no aplica),
 * aterriza según su rol — `/admin/tiquetes` para administrador/
 * agente_comercial, `/` para pasajero — para que el personal administrativo
 * nunca quede parado en el panel de pasajero por defecto.
 */
function LoginPage() {
  const { estaAutenticado, usuario, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  if (estaAutenticado) {
    return <Navigate to={calcularDestinoPostLogin(usuario.rol, location.state?.from)} replace />;
  }

  async function manejarSubmit(evento) {
    evento.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    try {
      const usuarioAutenticado = await login(correo, contrasena);
      const destino = calcularDestinoPostLogin(usuarioAutenticado.rol, location.state?.from);
      navigate(destino, { replace: true });
    } catch (err) {
      setError(err.message || MENSAJE_ERROR_GENERICO);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-100">
        <div className="mb-6 flex items-center justify-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-7 w-7 shrink-0 text-sky-600"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 12 3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12Zm0 0h7.5"
            />
          </svg>
          <span className="text-2xl font-semibold text-slate-800">SkyRoute</span>
        </div>

        <h1 className="mb-6 text-center text-base font-semibold text-slate-600">
          Inicia sesión en tu cuenta
        </h1>

        <form onSubmit={manejarSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="correo" className="text-sm font-medium text-slate-700">
              Correo electrónico
            </label>
            <input
              id="correo"
              name="correo"
              type="email"
              required
              autoComplete="email"
              placeholder="nombre@correo.com"
              value={correo}
              onChange={(evento) => setCorreo(evento.target.value)}
              disabled={isLoading}
              className="rounded-lg border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-100"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="contrasena" className="text-sm font-medium text-slate-700">
              Contraseña
            </label>
            {/* `relative`/`absolute` para superponer el botón del ojo sobre
                el input, en vez de un input + botón separados: así el
                campo sigue siendo un solo control visual. `pr-10` en el
                input evita que el texto quede debajo del ícono. */}
            <div className="relative">
              <input
                id="contrasena"
                name="contrasena"
                type={mostrarContrasena ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={contrasena}
                onChange={(evento) => setContrasena(evento.target.value)}
                disabled={isLoading}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-100"
              />
              <button
                type="button"
                onClick={() => setMostrarContrasena((actual) => !actual)}
                disabled={isLoading}
                aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={mostrarContrasena}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {mostrarContrasena ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="rounded-lg bg-sky-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
