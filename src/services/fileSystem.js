import fs from "fs/promises";
import path from "path";
import { loggerGlobal } from "../logging/loggerManager.js";

// Guarda un archivo desde un buffer, creando directorios si no existen
export const saveFileFromBuffer = async (filePath, buffer) => {
  try {
    // Crear directorios si no existen
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Guardar el archivo
    await fs.writeFile(filePath, buffer);
  } catch (error) {
    loggerGlobal.error(`Error guardando archivo ${filePath}:`, error);
    throw new Error(`No se pudo guardar el archivo: ${error.message}`);
  }
};

// Guarda múltiples archivos desde buffers, creando directorios si no existen
export const saveMultipleFilesFromBuffer = async (fileData) => {
  const savedFiles = [];
  const failedFiles = [];

  try {
    // Procesar todos los archivos
    for (const { filePath, buffer, originalName } of fileData) {
      try {
        await saveFileFromBuffer(filePath, buffer);
        savedFiles.push({ filePath, success: true });
        loggerGlobal.info(
          `Archivo guardado exitosamente: ${filePath}`
        );
      } catch (error) {
        failedFiles.push({
          filePath,
          error: error.message,
          success: false,
        });
        loggerGlobal.error(`Error guardando archivo ${filePath}:`, error);
      }
    }

    // Si hay archivos que fallaron, limpiar los exitosos (rollback)
    if (failedFiles.length > 0 && savedFiles.length > 0) {
      loggerGlobal.warn("Algunos archivos fallaron, ejecutando rollback...");
      await rollbackSavedFiles(savedFiles.map((f) => f.filePath));
    }

  } catch (error) {
    loggerGlobal.error("Error general guardando múltiples archivos:", error);

    // Limpiar archivos guardados en caso de error general
    if (savedFiles.length > 0) {
      await rollbackSavedFiles(savedFiles.map((f) => f.filePath));
    }

    throw new Error(`Error procesando múltiples archivos: ${error.message}`);
  }
};

// Rollback de archivos guardados
const rollbackSavedFiles = async (filePaths) => {
  for (const filePath of filePaths) {
    try {
      await fs.unlink(filePath);
      loggerGlobal.info(`Archivo eliminado en rollback: ${filePath}`);
    } catch (error) {
      loggerGlobal.error(
        `Error eliminando archivo en rollback ${filePath}:`,
        error
      );
    }
  }
};

// Verifica si un archivo existe en el sistema
export const checkFileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
