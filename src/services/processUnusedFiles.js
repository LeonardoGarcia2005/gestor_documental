import { filesDAO } from "../dataAccessObjects/filesDAO.js";

const processUnusedFiles = async () => {
    try {
        // Obtner los archivos que no estan siendo usados por el frontend
        const unusedFiles = await filesDAO.getUnusedFiles();

        if (!unusedFiles.length) {
            loggerGlobal.info("No se encontraron archivos sin usar para procesar");
            return;
        }

        const removedIds = [];
        // Se añade los ids que eliminaré en la base de datos en un arreglo
        for (const file of unusedFiles) {
            removedIds.push(file.id);
        }

        if (removedIds.length > 0) {
            await filesDAO.deleteFilesUnused(removedIds);
        }

        loggerGlobal.info(`Procesados ${removedIds.length} archivos sin usar`);
    } catch (error) {
        loggerGlobal.error("Error en processUnusedFiles:", error.message);
        throw error;
    }
}

export default processUnusedFiles;
