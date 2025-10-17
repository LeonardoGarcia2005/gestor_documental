import { CronJob } from "cron";
import { processUnusedFiles } from "../services/processUnusedFiles.js";
import { loggerGlobal } from "../logging/loggerManager.js";

/* ==========================================================
  Limpieza de archivos sin usar (cada 4 horas)
========================================================== */
const cleanupFilesJob = new CronJob(
  "0 */4 * * *",
  async () => {
    try {
      const result = await processUnusedFiles();
      if (result?.batchesQueued > 0) {
        loggerGlobal.info(
          `🎉 Cron exitoso: ${result.batchesQueued} lotes encolados para ${result.totalFiles} archivos`
        );
      } else {
        loggerGlobal.info("✅ Cron ejecutado, pero no se encontraron archivos para procesar");
      }
    } catch (error) {
      loggerGlobal.error("❌ Error en cron job de limpieza de archivos:", error.message);
    }
  },
  null,
  true,
  "America/Montevideo"
);

/* ==========================================================
  Crear backup de los archivos expirados (cada 4 dias)
========================================================== */
const backupFilesJob = new CronJob(
  "0 0 */4 * *",
  async () => {
    try {
      const result = await backupFiles();
      if (result?.batchesQueued > 0) {
        loggerGlobal.info(
          `🎉 Cron exitoso: ${result.batchesQueued} lotes encolados para ${result.totalFiles} archivos`
        );
      } else {
        loggerGlobal.info("✅ Cron ejecutado, pero no se encontraron archivos para procesar");
      }
    } catch (error) {
      loggerGlobal.error("❌ Error en cron job de limpieza de archivos:", error.message);
    }
  },
  null,
  true,
  "America/Montevideo"
);

export default {
  cleanupFilesJob,
  backupFilesJob,
};
