'use strict';

require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSocketServer } = require('./infrastructure/websocket/socketServer');
const { iniciarJobExpiracionBloqueos } = require('./infrastructure/jobs/expirarBloqueosJob');

const PORT = process.env.PORT || 3000;

// Socket.IO necesita el `http.Server` crudo (no la app de Express) para
// adjuntarse; por eso aquí se envuelve `app` en uno explícito en vez de
// usar `app.listen(...)` directo, como antes de HU-02.
const httpServer = http.createServer(app);
initSocketServer(httpServer);
iniciarJobExpiracionBloqueos();

httpServer.listen(PORT, () => {
  console.log(`[server] Sky Rout Operations API escuchando en puerto ${PORT}`);
});
