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
import { backupFiles } from './src/services/backupFiles.js'
import { initPgBoss, stopPgBoss } from './src/config/pgBoss.js'
import { registerFileCleanupWorker } from './src/workers/fileCleanupWorker.js'
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

app.use(express.static('src/public'));

// Saludo del gestor documental
app.get("/gestor/", (req, res) => {
  // Detectar el entorno (puedes ajustar esta lógica según tu configuración)
  const environment = process.env.NODE_ENV || 'development';
  const isProduction = environment === 'production';

  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Gestor Documental - ${isProduction ? 'Producción' : 'Desarrollo'}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: ${isProduction ? '#f5f7fa' : '#f0f4f8'};
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #2d3748;
        }
        
        .container {
          max-width: 800px;
          width: 90%;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07), 0 10px 20px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        .header {
          background: ${isProduction ? 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)' : 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)'};
          padding: 3rem 2rem;
          text-align: center;
          color: white;
          position: relative;
        }
        
        .environment-badge {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: ${isProduction ? '#10b981' : '#f59e0b'};
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        h1 {
          font-size: 2.5rem;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }
        
        .subtitle {
          font-size: 1.1rem;
          opacity: 0.95;
          font-weight: 300;
        }
        
        .content {
          padding: 2.5rem 2rem;
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        
        .info-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 1.5rem;
          text-align: center;
        }
        
        .info-card h3 {
          font-size: 0.875rem;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }
        
        .info-card p {
          font-size: 1.5rem;
          color: #1e293b;
          font-weight: 600;
        }
        
        .status-section {
          background: #f0fdf4;
          border: 1px solid #86efac;
          border-radius: 8px;
          padding: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .status-text {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .status-indicator {
          width: 12px;
          height: 12px;
          background: #10b981;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .status-text span {
          font-size: 1rem;
          color: #166534;
          font-weight: 500;
        }
        
        .status-badge {
          background: #10b981;
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-weight: 600;
          font-size: 0.875rem;
        }
        
        .footer {
          padding: 1.5rem 2rem;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          color: #64748b;
          font-size: 0.875rem;
        }
        
        .endpoints {
          margin-top: 2rem;
          text-align: left;
        }
        
        .endpoints h3 {
          font-size: 1rem;
          color: #475569;
          margin-bottom: 1rem;
          font-weight: 600;
        }
        
        .endpoint-list {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 1rem;
        }
        
        .endpoint-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem;
          font-size: 0.875rem;
          color: #475569;
        }
        
        .method {
          background: #3b82f6;
          color: white;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-weight: 600;
          font-size: 0.75rem;
          min-width: 60px;
          text-align: center;
        }
        
        @media (max-width: 640px) {
          h1 { font-size: 2rem; }
          .header { padding: 2rem 1.5rem; }
          .content { padding: 2rem 1.5rem; }
          .info-grid { grid-template-columns: 1fr; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="environment-badge">${isProduction ? 'Producción' : 'Desarrollo'}</div>
          <h1>Gestor Documental</h1>
          <p class="subtitle">Sistema de Gestión de Archivos y Documentos</p>
        </div>
        
        <div class="content">
          <div class="info-grid">
            <div class="info-card">
              <h3>Estado del Sistema</h3>
              <p>Operativo</p>
            </div>
            <div class="info-card">
              <h3>Entorno</h3>
              <p>${isProduction ? 'Producción' : 'Desarrollo'}</p>
            </div>
            <div class="info-card">
              <h3>Versión API</h3>
              <p>v1.0</p>
            </div>
          </div>
          
          <div class="status-section">
            <div class="status-text">
              <div class="status-indicator"></div>
              <span>API REST Operativa</span>
            </div>
            <div class="status-badge">ACTIVO</div>
          </div>
          
          <div class="endpoints">
            <h3>Endpoints Disponibles</h3>
          </div>
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} Gestor Documental. Todos los derechos reservados.</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Endpoint para testing de jobs
app.post('/test/run-job', async (req, res) => {

  try {
    let result;

    await backupFiles();
    result = 'Backup de archivos ejecutado';


    res.json({ success: true, message: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PREFIX = process.env.API_PREFIX

app.use(`${PREFIX}`, filesRouter)
app.use(`${PREFIX}`, companyRouter)

// Iniciar el servidor Express con el pgboss para el proceso de archivos en cola
const startServer = async () => {
  try {
    // Inicializar pg-boss (conecta a PostgreSQL)
    loggerGlobal.info('🚀 Inicializando pg-boss...');
    await initPgBoss();
    loggerGlobal.info('✅ pg-boss conectado a PostgreSQL');

    // Registrar el worker (empieza a ESCUCHAR la cola)
    await registerFileCleanupWorker();

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
  await stopPgBoss();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// INICIAR EL SERVIDOR CON TODO EL SISTEMA
startServer();