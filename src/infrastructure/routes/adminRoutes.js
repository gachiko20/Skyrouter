'use strict';

const { Router } = require('express');
const { actualizarEstadoTiquete, buscarTiquetes } = require('../controllers/tiquetesAdminController');
const { obtenerMetricas } = require('../controllers/adminController');
const { registrarVenta } = require('../controllers/ventasAdminController');
const requireAuth = require('../../middlewares/requireAuth');
const requireRole = require('../../middlewares/requireRole');

const router = Router();

// Mismo rol para toda el área /admin de momento (gestión de tiquetes y
// métricas): ambas operaciones las hace indistintamente un agente
// comercial o un administrador.
const ROLES_AREA_ADMIN = ['administrador', 'agente_comercial'];

// GET /api/admin/tiquetes?codigoReserva=...|?documento=...
// (SCRUM-10) — buscador básico, requiere sesión y rol de administrador o
// agente comercial.
router.get('/admin/tiquetes', requireAuth, requireRole(ROLES_AREA_ADMIN), buscarTiquetes);

// PATCH /api/admin/tiquetes/:id/estado
// Body: { estado: 'CANCELADO' } | { estado: 'REAGENDADO', nuevoVueloId, nuevoAsientoId }
// (SCRUM-10) — requiere sesión y rol de administrador o agente comercial.
router.patch(
  '/admin/tiquetes/:id/estado',
  requireAuth,
  requireRole(ROLES_AREA_ADMIN),
  actualizarEstadoTiquete
);

// POST /api/admin/ventas
// Body: { vueloId, asientoId, pasajero: { documento, nombres, apellidos, correo, telefono? } }
// Venta en mostrador (pago en efectivo/POS); registra id_agente desde el JWT.
router.post('/admin/ventas', requireAuth, requireRole(ROLES_AREA_ADMIN), registrarVenta);

// GET /api/admin/metricas (SCRUM-47) — requiere sesión y rol de
// administrador o agente comercial.
router.get('/admin/metricas', requireAuth, requireRole(ROLES_AREA_ADMIN), obtenerMetricas);

module.exports = router;
