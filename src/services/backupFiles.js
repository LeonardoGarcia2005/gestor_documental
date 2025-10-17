import { filesDAO } from "../dataAccessObjects/filesDAO.js";
import { loggerGlobal } from "../logging/loggerManager.js";

export const backupFiles = async () => {

        const filesExpired = await filesDAO.getFilesExpired();

        if (!filesExpired.length) {
            loggerGlobal.info('✅ [CRON] No hay archivos para procesar.\n');
            return { totalFiles: 0, batchesQueued: 0 };
        }
}