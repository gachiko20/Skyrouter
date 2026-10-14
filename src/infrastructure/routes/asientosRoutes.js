'use strict';

const { Router } = require('express');
const { bloquearAsiento } = require('../controllers/asientosController');
const requireAuth = require('../../middlewares/requireAuth');

const router = Router();

// POST /api/asientos/bloquear  { vueloId, asientoId } — requiere sesión; usuarioId viene del JWT, no del body.
router.post('/asientos/bloquear', requireAuth, bloquearAsiento);

module.exports = router;
