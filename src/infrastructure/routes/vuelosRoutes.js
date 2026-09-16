'use strict';

const { Router } = require('express');
const { listarVuelos } = require('../controllers/vuelosController');
const { listarAsientosPorVuelo } = require('../controllers/asientosController');

const router = Router();

// GET /api/vuelos?origen=&destino=&fecha=
router.get('/vuelos', listarVuelos);

// GET /api/vuelos/:vueloId/asientos
router.get('/vuelos/:vueloId/asientos', listarAsientosPorVuelo);

module.exports = router;
