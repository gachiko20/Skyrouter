'use strict';

const { Router } = require('express');
const { checkout } = require('../controllers/checkoutController');
const { descargarPaseAbordar, descargarFactura } = require('../controllers/tiquetesController');
const requireAuth = require('../../middlewares/requireAuth');

const router = Router();

// POST /api/tiquetes/checkout  { vueloId, asientoId, datosPasajero, datosPago } — requiere sesión; pasajeroId viene del JWT.
router.post('/tiquetes/checkout', requireAuth, checkout);

// GET /api/tiquetes/:id/pase-abordar — descarga el PDF; requiere sesión (dueño, agente o administrador, ver caso de uso).
router.get('/tiquetes/:id/pase-abordar', requireAuth, descargarPaseAbordar);

// GET /api/tiquetes/:id/factura — descarga el PDF; requiere sesión (dueño, agente o administrador, ver caso de uso).
router.get('/tiquetes/:id/factura', requireAuth, descargarFactura);

module.exports = router;
