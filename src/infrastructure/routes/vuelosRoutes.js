'use strict';

const { Router } = require('express');
const { listarVuelos, obtenerDisponibilidad } = require('../controllers/vuelosController');
const { listarAsientosPorVuelo } = require('../controllers/asientosController');

const router = Router();

// GET /api/vuelos?origen=&destino=&fecha=
router.get('/vuelos', listarVuelos);

// GET /api/vuelos/disponibilidad?origen=&destino= — días con vuelos futuros (calendario). Pública.
router.get('/vuelos/disponibilidad', obtenerDisponibilidad);

// GET /api/vuelos/:vueloId/asientos
router.get('/vuelos/:vueloId/asientos', listarAsientosPorVuelo);

module.exports = router;
