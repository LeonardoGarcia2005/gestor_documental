import fs from "fs/promises";
import path from "path";
import os from "os";
import { loggerGlobal } from "../logging/loggerManager.js";

const isUnixSystem = ["linux", "darwin"].includes(os.platform());

// Aplica permisos 755 a todas las carpetas de la ruta (recursivo)
const applyDirPermissionsRecursively = async (dirPath) => {
  if (!isUnixSystem) return; // No aplicar en Windows
  const parts = dirPath.split(path.sep);
  let currentPath = "";

  for (const part of parts) {
    if (!part) continue;
    currentPath += `/${part}`;
    try {
      await fs.chmod(currentPath, 0o755);
    } catch {
      // ignorar errores si alguna carpeta no existe aún
    }
  }
};

// Guarda un archivo desde un buffer
export const saveFileFromBuffer = async (filePath, buffer) => {
  try {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Guardar archivo
    await fs.writeFile(filePath, buffer);

    // Aplicar permisos solo si es Linux o macOS
    if (isUnixSystem) {
      await applyDirPermissionsRecursively(dir); // asegurar todas las carpetas
      await fs.chmod(filePath, 0o755);           // asegurar el archivo
    }

    loggerGlobal.info(`Archivo guardado exitosamente: ${filePath}`);
  } catch (error) {
    loggerGlobal.error(`Error guardando archivo ${filePath}:`, error);
    throw new Error(`No se pudo guardar el archivo: ${error.message}`);
  }
};

// Guarda múltiples archivos
export const saveMultipleFilesFromBuffer = async (fileData) => {
  const savedFiles = [];
  const failedFiles = [];

  try {
    for (const { filePath, buffer, originalName } of fileData) {
      try {
        await saveFileFromBuffer(filePath, buffer);
        savedFiles.push({ filePath, success: true });
      } catch (error) {
        failedFiles.push({
          filePath,
          originalName: originalName || filePath,
          error: error.message,
          success: false,
        });
      }
    }

    if (failedFiles.length > 0) {
      if (savedFiles.length > 0) {
        await rollbackSavedFiles(savedFiles.map((f) => f.filePath));
      }
      throw new Error(
        `No se pudieron guardar ${failedFiles.length} archivo(s): ${
          failedFiles.map(f => `${f.originalName} (${f.error})`).join(', ')
        }`
      );
    }

    return savedFiles;
  } catch (error) {
    loggerGlobal.error("Error general guardando múltiples archivos:", error);
    if (savedFiles.length > 0) {
      await rollbackSavedFiles(savedFiles.map((f) => f.filePath));
    }
    throw error;
  }
};

// Rollback
const rollbackSavedFiles = async (filePaths) => {
  for (const filePath of filePaths) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      loggerGlobal.error(`Error eliminando archivo en rollback ${filePath}:`, error);
    }
  }
};

// Verifica si un archivo existe
export const checkFileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};
