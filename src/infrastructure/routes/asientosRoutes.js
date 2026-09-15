'use strict';

const { Router } = require('express');
const { bloquearAsiento } = require('../controllers/asientosController');

const router = Router();

// POST /api/asientos/bloquear  { vueloId, asientoId, usuarioId }
router.post('/asientos/bloquear', bloquearAsiento);

module.exports = router;
