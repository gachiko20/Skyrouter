'use strict';

/**
 * Capa de Presentación (Infrastructure/HTTP) — traduce HTTP <-> casos de
 * uso de autenticación (SCRUM-49: login y registro). No contiene lógica de
 * negocio ni SQL; solo valida presencia de parámetros y formatea la
 * respuesta.
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { crearLoginUsuarioUseCase } = require('../../application/useCases/loginUsuarioUseCase');
const { crearRegistroUsuarioUseCase } = require('../../application/useCases/registroUsuarioUseCase');
const usuariosRepository = require('../repositories/usuariosRepository');
const { ValidationError } = require('../../errors/AppError');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  // Fallar rápido y ruidoso en el arranque, no en el primer login: un
  // JWT_SECRET ausente es un hueco de seguridad (o, con jsonwebtoken,
  // directamente un error de firma en cada intento), no un detalle de
  // configuración opcional que deba descubrirse en producción.
  throw new Error(
    '[auth] Falta la variable de entorno JWT_SECRET (ver JWT_SECRET en .env.example).'
  );
}

const loginUsuarioUseCase = crearLoginUsuarioUseCase({
  usuariosRepository,
  bcrypt,
  jwt,
  jwtSecret: JWT_SECRET,
});
const registroUsuarioUseCase = crearRegistroUsuarioUseCase({ usuariosRepository, bcrypt });

/**
 * POST /api/auth/login
 * Body: { correo, contrasena }
 *
 * 200 OK -> { status, code, data: { token, usuario: { idUsuario, nombreCompleto, correo, rol } } }
 * 400    -> faltan credenciales en el body
 * 401    -> correo o contraseña incorrectos
 */
async function login(req, res, next) {
  try {
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
      throw new ValidationError('correo y contrasena son obligatorios en el body.', 'DATOS_INCOMPLETOS');
    }

    const resultado = await loginUsuarioUseCase({ correo, contrasena });

    return res.status(200).json({
      status: 'success',
      code: 200,
      data: resultado,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/auth/registro
 * Body: { nombres, apellidos, correo, contrasena, telefono?, documentoIdentidad? }
 *
 * `rol` NUNCA se lee del body a propósito (ver nota de diseño en
 * `registroUsuarioUseCase.js`): todo autoregistro público es 'pasajero'.
 *
 * 201 Created -> { status, code, data: { usuario } }
 * 400         -> datos incompletos o inválidos (correo con formato inválido,
 *                contraseña débil)
 * 409         -> el correo ya está registrado
 */
async function registro(req, res, next) {
  try {
    const { nombres, apellidos, correo, contrasena, telefono, documentoIdentidad } = req.body;

    const usuario = await registroUsuarioUseCase({
      nombres,
      apellidos,
      correo,
      contrasena,
      telefono,
      documentoIdentidad,
    });

    return res.status(201).json({
      status: 'success',
      code: 201,
      data: { usuario },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { login, registro };
