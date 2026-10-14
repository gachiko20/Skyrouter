'use strict';

const { Router } = require('express');
const {
  obtenerHistorialVuelos,
  obtenerUsuario,
  actualizarPassword,
} = require('../controllers/usuariosController');
const requireAuth = require('../../middlewares/requireAuth');

const router = Router();

// GET /api/usuarios/:id — requiere sesión (dueño o administrador, ver controller)
router.get('/usuarios/:id', requireAuth, obtenerUsuario);

// GET /api/usuarios/:id/historial — requiere sesión (dueño o administrador)
router.get('/usuarios/:id/historial', requireAuth, obtenerHistorialVuelos);

// PATCH /api/usuarios/:id/password  { passwordActual, passwordNueva } — requiere sesión (solo el dueño)
router.patch('/usuarios/:id/password', requireAuth, actualizarPassword);

module.exports = router;
