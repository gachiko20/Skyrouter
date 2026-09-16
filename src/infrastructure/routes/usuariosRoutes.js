'use strict';

const { Router } = require('express');
const { obtenerHistorialVuelos } = require('../controllers/usuariosController');

const router = Router();

// GET /api/usuarios/:id/historial
router.get('/usuarios/:id/historial', obtenerHistorialVuelos);

module.exports = router;
