'use strict';

const express = require('express');
const cors = require('cors');
const asientosRoutes = require('./routes/asientosRoutes');
const vuelosRoutes = require('./infrastructure/routes/vuelosRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', asientosRoutes);
app.use('/api', vuelosRoutes);

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
