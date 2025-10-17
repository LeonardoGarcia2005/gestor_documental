import { getPgBoss } from '../config/pgBoss.js';
import { filesDAO } from '../dataAccessObjects/filesDAO.js';
import { loggerGlobal } from '../logging/loggerManager.js';
import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";
import { deletePhysicalFiles } from '../services/fileSystem.js';

const QUEUE_NAME = 'file-cleanup-batch';

export const registerFileCleanupWorker = async () => {
  const boss = getPgBoss();
  await boss.start();

  await boss.createQueue(QUEUE_NAME, {
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true
  });

  await boss.work(
    QUEUE_NAME,
    {
      teamSize: 1,
      teamConcurrency: 1
    },
    async (job) => {
      const { batchIds, batchNumber, totalBatches, batchFiles } = job[0].data;
      const now = new Date().toLocaleTimeString();

      loggerGlobal.info(`\n⚙️ [WORKER ${now}] Procesando lote ${batchNumber}/${totalBatches} (${batchIds.length} archivos)`);

      if (!batchIds.length) {
        loggerGlobal.info(`⚠️ No hay archivos para procesar en este lote.`);
        return { success: true, batchNumber, deletedFromDB: 0 };
      }

      try {
        // Ejecutar transacción
        const transactionResult = await dbConnectionProvider.tx(async (t) => {
          try {
            // Borrar registros de la BD
            loggerGlobal.info(`Borrando registros de la base de datos...`);
            await filesDAO.deleteFilesUnused(batchIds, t);
          } catch (dbError) {
            loggerGlobal.error(`❌ Error al eliminar registros de BD: ${dbError.message}`);
            throw dbError; // Esto hará rollback automáticamente
          }

          // Intentar borrar archivos físicos
          let physicalResults;
          try {
            loggerGlobal.info(`Borrando archivos físicos...`);
            physicalResults = await deletePhysicalFiles(batchFiles);
          } catch (fsError) {
            loggerGlobal.error(`❌ Error al eliminar archivos físicos: ${fsError.message}`);
            // No hacemos rollback de la BD, solo marcamos errores
            physicalResults = { failed: batchFiles, success: [], notFound: [] };
          }

          return {
            physicalResults
          };
        });

        // Manejo de resultados de archivos físicos
        const { physicalResults } = transactionResult;

        if (physicalResults.failed.length > 0) {
          loggerGlobal.warn(`⚠️ Archivos que no se pudieron eliminar: ${physicalResults.failed.length}`);
        }
        if (physicalResults.notFound.length > 0) {
          loggerGlobal.info(`ℹ️ Archivos no encontrados: ${physicalResults.notFound.length}`);
        }
        loggerGlobal.info(`Archivos eliminados correctamente: ${physicalResults.success.length}/${batchFiles.length}`);

        loggerGlobal.info(`\n✅ [WORKER ${now}] Lote ${batchNumber}/${totalBatches} completado (Archivos físicos: ${physicalResults.success.length})\n`);

      } catch (error) {
        loggerGlobal.error(`❌ [WORKER ${now}] Error en lote ${batchNumber}/${totalBatches}: ${error.message}`);
        throw error; // pg-boss manejará reintentos
      }
    }
  );

  loggerGlobal.info(`✅ Worker "${QUEUE_NAME}" registrado y escuchando 24/7`);
};