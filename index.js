import pkg1 from 'body-parser'
import express from 'express'
const { json, urlencoded } = pkg1
import cors from 'cors'
import { configurationProvider } from './src/config/configurationManager.js'
import filesRouter from "./src/routes/files.routes.js"
import companyRouter from "./src/routes/company.routes.js"
import { loggerGlobal } from './src/logging/loggerManager.js'
import { app } from './app.js'
import { exit } from 'node:process'
/* import { backupFiles } from './src/services/backupFiles.js'
import { initPgBoss, stopPgBoss } from './src/config/pgBoss.js'
import { registerFileCleanupWorker } from './src/workers/fileCleanupWorker.js' */
import "./src/jobs/jobs.js";

// Puerto del servidor web
const PUERTO_WEB = configurationProvider.port
loggerGlobal.debug(`Tengo el puerto web: ${PUERTO_WEB}`)

// Configuración de CORS para evitar problemas
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:6080',
    'https://pangeatech.com.uy:8888',
    'https://www.pangeatech.com.uy:8888',
    'https://agendateya.com.uy',
    'https://agendateya.com.co',
    'https://agendateya.com.ve',
    'https://www.pangeatech.com.uy:7433'
  ], // Origen permitido
  credentials: true, // Permitir credenciales
  allowedHeaders: ['sessionID', 'content-type', 'authorization'],
}

// Asegurarse de que CORS sea el primer middleware configurado
app.use(cors(corsOptions))

// Configura los límites de tamaño ANTES de las rutas
const limit = '1000mb'; // Límite de 100MB para archivos grandes

// Configurar body-parser con límites altos
app.use(json({
  limit: limit,
  extended: true
}))

app.use(urlencoded({
  limit: limit,
  extended: true,
  parameterLimit: 50000
}))

// Configurar timeout para requests largos
app.use((req, res, next) => {
  // Timeout de 5 minutos para uploads
  req.setTimeout(300000, () => {
    const err = new Error('Request timeout');
    err.status = 408;
    next(err);
  });

  res.setTimeout(300000, () => {
    const err = new Error('Response timeout');
    err.status = 504;
    next(err);
  });

  next();
});

// Endpoint para testing de jobs
/* app.post('/test/run-job', async (req, res) => {

  try {
    let result;

    await backupFiles();
    result = 'Backup de archivos ejecutado';


    res.json({ success: true, message: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}); */

const PREFIX = configurationProvider.api.prefix

app.use(`${PREFIX}`, filesRouter)
app.use(`${PREFIX}`, companyRouter)

// Iniciar el servidor Express con el pgboss para el proceso de archivos en cola
const startServer = async () => {
  try {
    // Inicializar pg-boss (conecta a PostgreSQL)
   /*  loggerGlobal.info('🚀 Inicializando pg-boss...'); */
    /* await initPgBoss(); */
  /*   loggerGlobal.info('✅ pg-boss conectado a PostgreSQL'); */

    // Registrar el worker (empieza a ESCUCHAR la cola)
    /* await registerFileCleanupWorker(); */

    // Iniciar el servidor Express
    const server = app.listen(PUERTO_WEB, () => {
      loggerGlobal.info(`🚀 Server listo en http://localhost:${PUERTO_WEB}`)
    })

    // Configurar timeout del servidor
    server.timeout = 300000;
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

  } catch (error) {
    loggerGlobal.error('❌ Error al iniciar el servidor:', error)
    exit(-1)
  }
}

// Cierre graceful (detiene pg-boss correctamente)
const shutdown = async () => {
  loggerGlobal.info('🛑 Cerrando aplicación...');
 /*  await stopPgBoss(); */
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// INICIAR EL SERVIDOR CON TODO EL SISTEMA
startServer();