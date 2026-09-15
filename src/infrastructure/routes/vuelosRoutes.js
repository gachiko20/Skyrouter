'use strict';

const { Router } = require('express');
const { listarVuelos } = require('../controllers/vuelosController');

const router = Router();

// GET /api/vuelos?origen=&destino=&fecha=
router.get('/vuelos', listarVuelos);

module.exports = router;
