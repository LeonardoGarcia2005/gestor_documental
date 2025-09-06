import winston from "winston";
import {configurationProvider} from "../config/configurationManager.js" ;

let loggerGlobal;

const logLevels = {
    fatal: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
    trace: 5,
  };

const {combine, timestamp, json, printf, colorize, align } = winston.format;

if (!loggerGlobal){
    console.log('Creando el logger global del sistema ...');
    console.log('Maximo nivel de log es: '+configurationProvider.maxLogLevel);
    loggerGlobal = winston.createLogger({
        levels: logLevels,
        level: configurationProvider.maxLogLevel || 'info',
        //format: combine(timestamp(), json()),
        //format: winston.format.json(),
        format: combine(
            //colorize({ all: true }),
            timestamp({
              format: 'YYYY-MM-DD hh:mm:ss.SSS A',
            }),
            align(),
            printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
            //printf((info) => `${info.level}: ${info.message}`)
          ),
        transports: [
            new winston.transports.Console(),
            new winston.transports.File({
                filename: 'Gestor-documental-Errores.log',
                level:'error',
            }),
        ],
      });
      
}

export {loggerGlobal}