import PgBoss from 'pg-boss';
import { loggerGlobal } from '../logging/loggerManager.js';
import { configurationProvider } from './configurationManager.js';

let boss = null;

export const initPgBoss = async () => {
  if (boss) return boss;

  boss = new PgBoss({
    host: configurationProvider.db.connection.host,
    port: configurationProvider.db.connection.port,
    database: configurationProvider.db.connection.database,
    user: configurationProvider.db.connection.user,
    password: configurationProvider.db.connection.password, // Viene de .env
    schema: configurationProvider.pgBoss.schema,
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    deleteAfterDays: 7,
    archiveCompletedAfterSeconds: 86400
  });

  boss.on('error', error => {
    loggerGlobal.error('❌ Error en pg-boss:', error);
  });

  await boss.start();
  loggerGlobal.info('✅ pg-boss iniciado correctamente');

  return boss;
};

export const getPgBoss = () => {
  if (!boss) {
    throw new Error('pg-boss no ha sido inicializado. Llama a initPgBoss() primero.');
  }
  return boss;
};

export const stopPgBoss = async () => {
  if (boss) {
    await boss.stop();
    loggerGlobal.info('✅ pg-boss detenido');
  }
};