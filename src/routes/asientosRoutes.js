'use strict';

const { Router } = require('express');
const { bloquearAsiento } = require('../controllers/asientosController');
const requireAuth = require('../middlewares/requireAuth');

const router = Router();

// POST /api/vuelos/:vueloId/asientos/:asientoId/bloqueo  { usuarioId }
// SCRUM-49: solo se le agrega requireAuth (cierra el endpoint a quien no
// tenga sesión). No se moderniza este controlador para tomar el usuario
// del JWT como en asientosController.bloquearAsiento (infrastructure/):
// es el endpoint original de SCRUM-6, ya reemplazado en el frontend por
// POST /api/asientos/bloquear (HU-02) y solo sigue vivo porque
// tests/stress/concurrencyTest.js lo ejercita. Candidato a eliminar en una
// limpieza futura.
router.post('/vuelos/:vueloId/asientos/:asientoId/bloqueo', requireAuth, bloquearAsiento);

module.exports = router;
