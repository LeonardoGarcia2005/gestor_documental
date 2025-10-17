import { filesDAO } from '../dataAccessObjects/filesDAO.js';
import { getPgBoss } from '../config/pgBoss.js';
import { loggerGlobal } from '../logging/loggerManager.js';

const BATCH_SIZE = parseInt(process.env.FILE_BATCH_SIZE || '20');
const DELAY_MINUTES = parseInt(process.env.FILE_BATCH_DELAY_MINUTES || '10');
const QUEUE_NAME = 'file-cleanup-batch';

export const processUnusedFiles = async () => {
  const startTime = Date.now();

  try {
    loggerGlobal.info('='.repeat(60));
    loggerGlobal.info('🔍 [CRON] Iniciando búsqueda de archivos sin usar...');

    const unusedFiles = await filesDAO.getUnusedFiles();

    if (!unusedFiles.length) {
      loggerGlobal.info('✅ [CRON] No hay archivos para procesar.\n');
      return { totalFiles: 0, batchesQueued: 0 };
    }

    loggerGlobal.info(`📦 [CRON] Encontrados ${unusedFiles.length} archivos sin usar`);

    // ✅ Marcar INMEDIATAMENTE como encolados
    const fileIds = unusedFiles.map(f => f.id);
    await filesDAO.changeStatusFilesAsQueued(fileIds, true);

    // Dividir en lotes
    const batches = [];
    for (let i = 0; i < unusedFiles.length; i += BATCH_SIZE) {
      batches.push(unusedFiles.slice(i, i + BATCH_SIZE));
    }

    const totalBatches = batches.length;
    loggerGlobal.info(`📦 [CRON] Los ${unusedFiles.length} archivos se dividieron en ${totalBatches} lote(s).`);
    const boss = getPgBoss();

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const delaySeconds = i === 0 ? 1 : i * DELAY_MINUTES * 60;

      try {
        await boss.send(
          QUEUE_NAME,
          {
            batchIds: batch.map(f => f.id),
            batchFiles: batch.map(f => ({
              id: f.id,
              code: f.code,
              type: f.type
            })),
            batchNumber: i + 1,
            totalBatches
          },
          {
            startAfter: delaySeconds,
            retryLimit: 3,
            retryDelay: 60,
            retryBackoff: true
          }
        );

      } catch (error) {
        loggerGlobal.error(`❌ Error encolando lote ${i + 1}:`, error.message);
        // Revertir el marcado si falla
        await filesDAO.changeStatusFilesAsQueued(batch.map(f => f.id), false);
        throw error;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const totalMinutes = totalBatches * DELAY_MINUTES;

    // Mostrar horas o minutos de forma intuitiva
    let estimatedTimeMessage;
    if (totalMinutes >= 60) {
      const hours = (totalMinutes / 60).toFixed(1);
      estimatedTimeMessage = `~${hours} hora${hours > 1 ? 's' : ''}`;
    } else {
      estimatedTimeMessage = `~${totalMinutes} minuto${totalMinutes > 1 ? 's' : ''}`;
    }

    loggerGlobal.info('='.repeat(60));
    loggerGlobal.info(`   • Tiempo estimado de procesamiento: ${estimatedTimeMessage}`);


    return {
      totalFiles: unusedFiles.length,
      batchesQueued: totalBatches,
      estimatedProcessingTime: estimatedTimeMessage
    };

  } catch (error) {
    loggerGlobal.error('❌ [CRON] Error crítico:', error.message);
    throw error;
  }
};
