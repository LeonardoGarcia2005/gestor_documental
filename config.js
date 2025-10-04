
import convict from 'convict';
import convictFormatWithValidator from 'convict-format-with-validator';

convict.addFormat(convictFormatWithValidator.ipaddress);

// Define un esquema de configuración
const config = convict({
    env: {
        doc: 'The application environment.',
        format: ['production', 'development', 'test'],
        default: 'development',
        env: 'NODE_ENV'
    },

    services: {
        host: {
            doc: 'Nombre del servidor que provee los servicios del backend',
            format: '*',
            default: 'localhost',
            sensitive: true,
        },
        port: {
            doc: 'Puerto del servidor que provee los servicios del backend',
            format: 'port',
            default: 6000,
        },
    },
    db: {
        host: {
            doc: 'Nombre del servidor de BD en el dominio',
            format: '*',
            default: 'localhost',
            sensitive: true,
        },
        port: {
            doc: 'Puerto del servidor de BD',
            format: 'port',
            default: 5432,
        },
        name: {
            doc: 'Nombre de la BD',
            format: String,
            default: 'gestor_documental'
        },
        user: {
            doc: 'Usuario para acceder a la BD',
            format: String,
            default: 'postgres',
        },
        password: {
            doc: 'Clave para acceder a la BD',
            format: String,
            default: 'postgres',
        }
    },
    pgPromise: {
        ssl: {
            doc: 'SSL configuration for pg-promise',
            format: Boolean,
            default: false
        },
        max: {
            doc: 'Max number of connections in the pool',
            format: 'int',
            default: 2
        },
        idleTimeoutMillis: {
            doc: 'Idle timeout for connections',
            format: 'int',
            default: 30000
        },
        connectionTimeoutMillis: {
            doc: 'Connection timeout in milliseconds',
            format: 'int',
            default: 6000
        },
        maxUses: {
            doc: 'Max uses for each connection',
            format: 'int',
            default: 7500
        }
    },
    maxLogLevel: {
        doc: 'Maximum log level',
        format: ['debug', 'info', 'warn', 'error'],
        default: 'debug'
    },
    admins: {
        doc: 'Users with write access, or null to grant full access without login.',
        format: Array,
        nullable: true,
        default: null
    }
});

// Cargar la configuración dependiente del entorno
const env = config.get('env');
try {
    config.loadFile(`./src/config/${env}.json`);
} catch (error) {
    console.error(`Error loading config file: ${error.message}`);
    process.exit(1);
}

// Validar la configuración
config.validate({ allowed: 'strict' });

export default config;
