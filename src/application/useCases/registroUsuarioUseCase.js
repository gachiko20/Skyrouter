'use strict';

/**
 * Capa de Aplicación — caso de uso "Registrar usuario" (SCRUM-49).
 *
 * Orquesta: valida los datos de entrada, verifica que el correo no exista
 * todavía, hashea la contraseña con `bcrypt.hash` y delega la persistencia
 * al repositorio inyectado. `usuariosRepository` y `bcrypt` se reciben por
 * parámetro (inyección de dependencias) para que este caso de uso sea
 * testeable sin PostgreSQL ni cómputo real de hashing.
 *
 * El `rol` NUNCA se recibe como parámetro de este caso de uso: todo
 * autoregistro público crea un 'pasajero', sin excepción (ver
 * `ROL_POR_DEFECTO` abajo). Asignar 'agente_comercial' o 'administrador' es
 * un flujo administrativo distinto, fuera de alcance de SCRUM-49 — si se
 * expusiera aquí, cualquier cliente podría autoasignarse ese rol con solo
 * mandarlo en el body del POST.
 */

const { ConflictError, ValidationError } = require('../../errors/AppError');

const SALT_ROUNDS = 10;
const ROL_POR_DEFECTO = 'pasajero';
const LONGITUD_MINIMA_PASSWORD = 8;
const PATRON_PASSWORD_VALIDA = /(?=.*[A-Za-z])(?=.*\d).{8,}/;
const PATRON_CORREO = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const MENSAJE_DATOS_INCOMPLETOS = 'nombres, apellidos, correo y contrasena son obligatorios.';
const MENSAJE_CORREO_INVALIDO = 'El correo electrónico no tiene un formato válido.';
const MENSAJE_PASSWORD_INVALIDA =
  'La contraseña debe tener mínimo 8 caracteres, incluyendo letras y números.';
const MENSAJE_CORREO_YA_REGISTRADO = 'Ya existe una cuenta registrada con ese correo electrónico.';

function validarDatos({ nombres, apellidos, correo, contrasena }) {
  if (!nombres || !apellidos || !correo || !contrasena) {
    throw new ValidationError(MENSAJE_DATOS_INCOMPLETOS, 'DATOS_INCOMPLETOS');
  }

  if (!PATRON_CORREO.test(correo)) {
    throw new ValidationError(MENSAJE_CORREO_INVALIDO, 'CORREO_INVALIDO');
  }

  if (contrasena.length < LONGITUD_MINIMA_PASSWORD || !PATRON_PASSWORD_VALIDA.test(contrasena)) {
    throw new ValidationError(MENSAJE_PASSWORD_INVALIDA, 'PASSWORD_INVALIDA');
  }
}

/**
 * @param {{
 *   usuariosRepository: { obtenerUsuarioPorCorreoConHash: Function, crearUsuario: Function },
 *   bcrypt: { hash: Function },
 * }} dependencias
 * @returns {(datos: {
 *   nombres: string, apellidos: string, correo: string, contrasena: string,
 *   telefono?: string, documentoIdentidad?: string,
 * }) => Promise<object>}
 */
function crearRegistroUsuarioUseCase({ usuariosRepository, bcrypt }) {
  return async function registroUsuario({
    nombres,
    apellidos,
    correo,
    contrasena,
    telefono,
    documentoIdentidad,
  }) {
    validarDatos({ nombres, apellidos, correo, contrasena });

    const existente = await usuariosRepository.obtenerUsuarioPorCorreoConHash(correo);
    if (existente.ok) {
      throw new ConflictError(MENSAJE_CORREO_YA_REGISTRADO, 'CORREO_YA_REGISTRADO');
    }

    const hashContrasena = await bcrypt.hash(contrasena, SALT_ROUNDS);

    const resultado = await usuariosRepository.crearUsuario({
      nombres,
      apellidos,
      correo,
      hashContrasena,
      telefono,
      documentoIdentidad,
      rol: ROL_POR_DEFECTO,
    });

    if (!resultado.ok) {
      // Red de seguridad: dos registros simultáneos con el mismo correo
      // pueden pasar ambos la verificación de arriba antes de que cualquiera
      // haga INSERT (TOCTOU); `crearUsuario` atrapa esa colisión en la
      // restricción única y la reporta aquí.
      throw new ConflictError(MENSAJE_CORREO_YA_REGISTRADO, 'CORREO_YA_REGISTRADO');
    }

    return resultado.usuario;
  };
}

module.exports = { crearRegistroUsuarioUseCase };
