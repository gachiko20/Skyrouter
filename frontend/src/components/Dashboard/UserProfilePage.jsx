import { useEffect, useRef, useState } from 'react';
import { obtenerUsuario, actualizarPassword } from '../../services/usuariosApi.js';
import { useAuth } from '../../state/AuthContext.jsx';
import ProfileSkeleton from './ProfileSkeleton.jsx';
import ToastAlerta from '../Cabina/ToastAlerta.jsx';

const ESTADO_INICIAL_PASSWORD = {
  actual: '',
  nueva: '',
  confirmar: '',
};

const MENSAJE_ERROR_PERFIL_GENERICO = 'No fue posible cargar los datos del perfil.';
const MENSAJE_CONTRASENAS_DISTINTAS = 'Las contraseñas no coinciden.';
const MENSAJE_PASSWORD_ACTUALIZADA = 'Contraseña actualizada correctamente.';
const MENSAJE_ERROR_PASSWORD_GENERICO = 'No fue posible actualizar la contraseña.';
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
 * Ruta `/perfil`, montada dentro de `DashboardLayout` (que ya garantiza
 * sesión activa). Consume `GET /api/usuarios/:id` (backend en Clean
 * Architecture: usuariosController -> obtenerPerfilUsuarioUseCase ->
 * usuariosRepository) y conecta el formulario de cambio de contraseña a
 * `PATCH /api/usuarios/:id/password`, usando el `idUsuario` real de
 * `AuthContext` (SCRUM-49) en vez del antiguo `VITE_USUARIO_ID_DEV`.
 */
function UserProfilePage() {
  const { usuario: usuarioSesion } = useAuth();
  const usuarioId = usuarioSesion.idUsuario;

  const [usuario, setUsuario] = useState(null);
  const [isLoadingPerfil, setIsLoadingPerfil] = useState(true);
  const [errorPerfil, setErrorPerfil] = useState(null);

  const [formPassword, setFormPassword] = useState(ESTADO_INICIAL_PASSWORD);
  const [enviandoPassword, setEnviandoPassword] = useState(false);
  const [toast, setToast] = useState(null);
  const confirmarRef = useRef(null);

  useEffect(() => {
    let cancelado = false;

    setIsLoadingPerfil(true);
    setErrorPerfil(null);

    obtenerUsuario(usuarioId)
      .then((resultado) => {
        if (!cancelado) setUsuario(resultado);
      })
      .catch((err) => {
        if (!cancelado) setErrorPerfil(err.message || MENSAJE_ERROR_PERFIL_GENERICO);
      })
      .finally(() => {
        if (!cancelado) setIsLoadingPerfil(false);
      });

    return () => {
      cancelado = true;
    };
  }, [usuarioId]);

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

  async function manejarSubmitPassword(evento) {
    evento.preventDefault();
    if (enviandoPassword) return;

    setEnviandoPassword(true);
    setToast(null);
    try {
      await actualizarPassword(usuarioId, {
        passwordActual: formPassword.actual,
        passwordNueva: formPassword.nueva,
      });
      setToast({ mensaje: MENSAJE_PASSWORD_ACTUALIZADA, tipo: 'info' });
      setFormPassword(ESTADO_INICIAL_PASSWORD);
    } catch (err) {
      setToast({ mensaje: err.message || MENSAJE_ERROR_PASSWORD_GENERICO, tipo: 'error' });
    } finally {
      setEnviandoPassword(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-800">Mi Perfil</h1>

      {errorPerfil && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {errorPerfil}
        </div>
      )}

      {isLoadingPerfil && <ProfileSkeleton />}

      {!isLoadingPerfil && usuario && (
        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-sky-600 text-2xl font-bold text-white">
              {obtenerIniciales(usuario.nombreCompleto)}
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-lg font-bold text-slate-800">{usuario.nombreCompleto}</p>
              <span className="inline-flex w-fit self-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700 sm:self-start">
                {usuario.rol}
              </span>
            </div>
          </div>

          <dl className="mt-6 flex flex-col gap-3 rounded-lg bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-slate-500">Correo electrónico</dt>
              <dd className="text-sm font-medium text-slate-800">{usuario.correo}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-slate-500">Teléfono</dt>
              <dd className="text-sm font-medium text-slate-800">{usuario.telefono || '—'}</dd>
            </div>
          </dl>
        </section>
      )}

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
              disabled={enviandoPassword}
              className="rounded-lg border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-100"
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
                disabled={enviandoPassword}
                className="rounded-lg border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-100"
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
                disabled={enviandoPassword}
                className="rounded-lg border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-100"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={enviandoPassword}
            className="self-start rounded-lg bg-sky-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {enviandoPassword ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
        </form>
      </section>

      {toast && (
        <ToastAlerta mensaje={toast.mensaje} tipo={toast.tipo} onCerrar={() => setToast(null)} />
      )}
    </div>
  );
}

export default UserProfilePage;
