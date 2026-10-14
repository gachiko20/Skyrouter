'use strict';

const { Router } = require('express');
const { login, registro } = require('../controllers/authController');

const router = Router();

// POST /api/auth/login  { correo, contrasena }
router.post('/auth/login', login);

// POST /api/auth/registro  { nombres, apellidos, correo, contrasena, telefono?, documentoIdentidad? }
router.post('/auth/registro', registro);

module.exports = router;
