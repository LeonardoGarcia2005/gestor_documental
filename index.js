import pkg1 from 'body-parser'
const { json, urlencoded } = pkg1
import cors from 'cors'
import { configurationProvider } from './src/config/configurationManager.js'
import filesRouter from "./src/routes/files.routes.js"
import companyRouter from "./src/routes/company.routes.js"
import { loggerGlobal } from './src/logging/loggerManager.js'
import { app } from './app.js'
import { exit } from 'node:process'

// Puerto del servidor web
const PUERTO_WEB = configurationProvider.port
loggerGlobal.debug(`Tengo el puerto web: ${PUERTO_WEB}`)

// Configuración de CORS para evitar problemas
const corsOptions = {
  origin: [
    'http://localhost:5173', 
    'https://pangeatech.com.uy:8888', 
    'https://www.pangeatech.com.uy:8888', 
    'https://agendateya.com.uy', 
    'https://agendateya.com.co', 
    'https://agendateya.com.ve'
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

// Saludo del gestor documental
app.get("/", (_, res) => {
  res.send("Gestor Documental");
});

const API_PREFIX = "/gestor/api"

app.use(`${API_PREFIX}`, filesRouter)
app.use(`${API_PREFIX}`, companyRouter)

// Iniciar el servidor Express
try {
  const server = app.listen(PUERTO_WEB, () => {
    loggerGlobal.info(`🚀 Server listo en http://localhost:${PUERTO_WEB}`)
  })
  
  // Configurar timeout del servidor
  server.timeout = 300000; // 5 minutos
  server.keepAliveTimeout = 65000; // 65 segundos
  server.headersTimeout = 66000; // 66 segundos
  
} catch (error) {
  loggerGlobal.error(
    'Error al iniciar el servidor; No se podrá iniciar el sistema...',
    error
  )
  exit(-1)
}