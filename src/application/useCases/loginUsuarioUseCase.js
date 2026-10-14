'use strict';

/**
 * Capa de Aplicación — caso de uso "Iniciar sesión" (SCRUM-49).
 *
 * Orquesta: busca al usuario por correo, verifica la contraseña con
 * `bcrypt.compare` contra el hash persistido y, si coincide, firma un JWT
 * con `{ idUsuario, rol }` en el payload. `usuariosRepository`, `bcrypt` y
 * `jwt` se reciben por parámetro (inyección de dependencias) para que este
 * caso de uso sea testeable sin PostgreSQL ni cómputo real de hashing/firma.
 */

const { UnauthorizedError } = require('../../errors/AppError');

const JWT_EXPIRACION = '2h';

const MENSAJE_CREDENCIALES_INVALIDAS = 'Correo o contraseña incorrectos.';

/**
 * @param {{
 *   usuariosRepository: { obtenerUsuarioPorCorreoConHash: Function },
 *   bcrypt: { compare: Function },
 *   jwt: { sign: Function },
 *   jwtSecret: string,
 * }} dependencias
 * @returns {(datos: { correo: string, contrasena: string }) => Promise<{ token: string, usuario: object }>}
 */
function crearLoginUsuarioUseCase({ usuariosRepository, bcrypt, jwt, jwtSecret }) {
  return async function loginUsuario({ correo, contrasena }) {
    const resultado = await usuariosRepository.obtenerUsuarioPorCorreoConHash(correo);

    // Mismo error para "el correo no existe" y "la contraseña no coincide":
    // distinguirlos le permitiría a un atacante enumerar qué correos están
    // registrados probando uno por uno.
    if (!resultado.ok) {
      throw new UnauthorizedError(MENSAJE_CREDENCIALES_INVALIDAS, 'CREDENCIALES_INVALIDAS');
    }

    const { usuario } = resultado;
    const coincide = await bcrypt.compare(contrasena, usuario.hashContrasena);

    if (!coincide) {
      throw new UnauthorizedError(MENSAJE_CREDENCIALES_INVALIDAS, 'CREDENCIALES_INVALIDAS');
    }

    const token = jwt.sign({ idUsuario: usuario.idUsuario, rol: usuario.rol }, jwtSecret, {
      expiresIn: JWT_EXPIRACION,
    });

    return {
      token,
      usuario: {
        idUsuario: usuario.idUsuario,
        nombreCompleto: usuario.nombreCompleto,
        correo: usuario.correo,
        rol: usuario.rol,
      },
    };
  };
}

module.exports = { crearLoginUsuarioUseCase };
