import dotenv from 'dotenv';
dotenv.config();
import config from '../../config.js';

// Obtener la configuración de la base de datos
// NOTA: El password viene de .env (process.env.DB_PASSWORD)
const dbConfig = {
    client: 'pg', // PostgreSQL client
    connection: {
        host: config.get('db.host'),
        port: config.get('db.port'),
        database: config.get('db.name'),
        user: config.get('db.user'),
        password: process.env.DB_PASSWORD // Secreto desde .env
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

// Configuración de uploads desde JSON
const uploadsConfigFromJson = {
    maxFileSize: config.get('uploads.maxFileSize'),
    maxFilesCount: config.get('uploads.maxFilesCount'),
    maxFilenameLength: config.get('uploads.maxFilenameLength'),
    maxFieldSizeKB: config.get('uploads.maxFieldSizeKB'),
    pathPublicNginx: config.get('uploads.pathPublicNginx'),
    securityPublicLevel: config.get('uploads.securityPublicLevel')
};

// Configuración de archivos
const filesConfig = {
    expirationDays: config.get('files.expirationDays'),
    batchSize: config.get('files.batchSize'),
    batchDelayMinutes: config.get('files.batchDelayMinutes'),
    jwtExpiresIn: process.env.FILE_JWT_EXPIRES_IN || '1h' // Desde .env
};

// Configuración de Nginx
const nginxConfig = {
    publicLocation: config.get('nginx.publicLocation')
};

// Configuración de API
const apiConfig = {
    prefix: config.get('api.prefix')
};

// Configuración de backup
const backupConfig = {
    pathPublic: config.get('backup.pathPublic'),
    pathPrivate: config.get('backup.pathPrivate')
};

// Configuración de PgBoss
const pgBossConfig = {
    schema: config.get('pgBoss.schema')
};

// Configuración de JWT (secretos desde .env)
const jwtConfig = {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.FILE_JWT_EXPIRES_IN || '1h'
};

// Exportar configuración consolidada
const configurationProvider = {
    db: dbConfig,
    server: serverConfig,
    auth: authConfig,
    cors: corsConfig,
    uploads: { ...uploadsConfig, ...uploadsConfigFromJson },
    logging: loggingConfig,
    files: filesConfig,
    nginx: nginxConfig,
    api: apiConfig,
    backup: backupConfig,
    pgBoss: pgBossConfig,
    jwt: jwtConfig,
    port: serverConfig.port,
    maxLogLevel: config.get('maxLogLevel'),
    baseUrl: process.env.BASE_URL || 'http://localhost:6080',
    // Método para obtener cualquier configuración por ruta
    get: (path) => {
        return path.split('.').reduce((obj, key) => {
            return obj && obj[key] !== undefined ? obj[key] : undefined;
        }, configurationProvider);
    }
};

export { configurationProvider };
