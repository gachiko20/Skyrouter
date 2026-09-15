'use strict';

const { Router } = require('express');
const { bloquearAsiento } = require('../controllers/asientosController');

const router = Router();

// POST /api/vuelos/:vueloId/asientos/:asientoId/bloqueo  { usuarioId }
router.post('/vuelos/:vueloId/asientos/:asientoId/bloqueo', bloquearAsiento);

module.exports = router;
