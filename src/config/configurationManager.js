import dotenv from 'dotenv';
dotenv.config();
import config from '../../config.js';

// Obtener la configuración de la base de datos
const dbConfig = {
    client: 'pg', // PostgreSQL client
    connection: {
        host: config.get('db.host'),
        port: config.get('db.port'),
        database: config.get('db.name'),
        user: config.get('db.user'),
        password: config.get('db.password')
    },
    pool: {
        min: 1,
        max: config.get('pgPromise.max'),
        idleTimeoutMillis: config.get('pgPromise.idleTimeoutMillis'),
        acquireTimeoutMillis: config.get('pgPromise.connectionTimeoutMillis')
    },
    migrations: {
        directory: './migrations',
        tableName: 'knex_migrations'
    },
    seeds: {
        directory: './seeds'
    }
};

// Configuración del servidor
const serverConfig = {
    host: config.get('services.host'),
    port: config.get('services.port'),
    environment: config.get('env')
};

// Configuración de autenticación
const authConfig = {
    // Configuración de autenticación básica si es necesaria
};

// Configuración de CORS
const corsConfig = {
    origin: [
        'http://localhost:5173',
        'https://pangeatech.com.uy:8888',
        'https://www.pangeatech.com.uy:8888',
        'https://agendateya.com.uy',
        'https://agendateya.com.co',
        'https://agendateya.com.ve'
    ],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
};

// Configuración de subida de archivos
const uploadsConfig = {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    directory: './uploads'
};

// Configuración de logs
const loggingConfig = {
    level: config.get('maxLogLevel') || 'debug',
    console: {
        enabled: true,
        colorize: true
    }
};

// Exportar configuración consolidada
const configurationProvider = {
    db: dbConfig,
    server: serverConfig,
    auth: authConfig,
    cors: corsConfig,
    uploads: uploadsConfig,
    logging: loggingConfig,
    port: serverConfig.port,
    // Método para obtener cualquier configuración por ruta
    get: (path) => {
        return path.split('.').reduce((obj, key) => {
            return obj && obj[key] !== undefined ? obj[key] : undefined;
        }, configurationProvider);
    }
};

export { configurationProvider };
