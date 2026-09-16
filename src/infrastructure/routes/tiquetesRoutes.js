'use strict';

const { Router } = require('express');
const { checkout } = require('../controllers/checkoutController');

const router = Router();

// POST /api/tiquetes/checkout  { vueloId, asientoId, pasajeroId, datosPasajero, datosPago }
router.post('/tiquetes/checkout', checkout);

module.exports = router;
