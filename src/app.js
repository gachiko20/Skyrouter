'use strict';

const express = require('express');
const cors = require('cors');
const asientosRoutes = require('./routes/asientosRoutes');
const vuelosRoutes = require('./infrastructure/routes/vuelosRoutes');
// HU-02 (SCRUM-8): bloqueo temporal de asientos, en Clean Architecture
// (infrastructure/routes), independiente de la reserva definitiva de
// SCRUM-6 expuesta en ./routes/asientosRoutes.
const bloqueoTemporalAsientosRoutes = require('./infrastructure/routes/asientosRoutes');
const tiquetesRoutes = require('./infrastructure/routes/tiquetesRoutes');
const usuariosRoutes = require('./infrastructure/routes/usuariosRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', asientosRoutes);
app.use('/api', vuelosRoutes);
app.use('/api', bloqueoTemporalAsientosRoutes);
app.use('/api', tiquetesRoutes);
app.use('/api', usuariosRoutes);

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    code: 404,
    message: 'Recurso no encontrado.',
  });
});

// Debe registrarse al final: Express lo reconoce como error handler por
// tener 4 parámetros (err, req, res, next).
app.use(errorHandler);

module.exports = app;
