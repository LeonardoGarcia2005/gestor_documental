import express from "express";
import http from "http";
import { dbConnectionProvider } from "./src/config/db/dbConnectionManager.js";
import { loggerGlobal } from "./src/logging/loggerManager.js";
import { exit } from "process";

// Configuración de variables de entorno
import "dotenv/config";

// Verificar si el logger está disponible
if (!loggerGlobal) {
  console.error(
    "No se pudo crear el logger global: No podrá iniciarse el sistema."
  );
  exit(-1);
}

// Verificar conexión a la base de datos
const conectoServerBD = await dbConnectionProvider.verificarConexionBD();
if (conectoServerBD == null) {
  loggerGlobal.error(
    "No se logró establecer conexión a la BD; NO se podrá iniciar el servidor"
  );
  exit(-1);
} else {
  loggerGlobal.info("Se logró conectar a la BD ...");
}

// Configuración del servidor Express
const app = express();
//Configuración para permitir recibir peticiones con "json"
app.use(express.json());
const httpServer = http.createServer(app);
//Configuración para permitir recibir peticiones con "json"
app.use(express.json());
loggerGlobal.info("Creado el servidor web para HTTP con Express ...");

// Exportar la configuración del servidor HTTP
export { app, httpServer };
