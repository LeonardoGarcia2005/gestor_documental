import fs from "fs/promises";
import path from "path";
import os from "os";
import { loggerGlobal } from "../logging/loggerManager.js";
import { normalizePath } from "../lib/formatters.js";
import { fileParameterValueDAO } from "../dataAccessObjects/fileParameterValueDAO.js";

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

// Reemplaza un archivo existente por uno nuevo desde un buffer
export const replaceFileFromBuffer = async (filePath, buffer, newFileName) => {
  try {
    // Verificar si el archivo existe
    const fileExists = await checkFileExists(filePath);

    if (fileExists) {
      // Eliminar el archivo existente
      await fs.unlink(filePath);
      loggerGlobal.info(`Archivo existente eliminado: ${filePath}`);
    }

    // Obtener el directorio y construir la nueva ruta con el nuevo nombre
    const dir = path.dirname(filePath);
    const newFilePath = path.join(dir, newFileName);

    // Asegurar que el directorio existe
    await fs.mkdir(dir, { recursive: true });

    // Guardar el nuevo archivo con el nuevo nombre
    await fs.writeFile(newFilePath, buffer);

    // Aplicar permisos solo si es Linux o macOS
    if (isUnixSystem) {
      await applyDirPermissionsRecursively(dir);
      await fs.chmod(newFilePath, 0o755);
    }

    loggerGlobal.info(`Archivo reemplazado exitosamente: ${filePath} → ${newFilePath}`);
    return { success: true, filePath: newFilePath };
  } catch (error) {
    loggerGlobal.error(`Error reemplazando archivo ${filePath}:`, error);
    throw new Error(`No se pudo reemplazar el archivo: ${error.message}`);
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
        `No se pudieron guardar ${failedFiles.length} archivo(s): ${failedFiles.map(f => `${f.originalName} (${f.error})`).join(', ')
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

// Copia un archivo privado a un destino público temporal
export const copyFileToPublicDestination = async (sourcePath, destinationDir, fileName) => {
  try {
    await fs.access(sourcePath);
    await fs.mkdir(destinationDir, { recursive: true });

    const destinationPath = `${normalizePath(destinationDir)}/${fileName}`;

    try {
      await fs.access(destinationPath);
      loggerGlobal.info(`Archivo temporal ya existe: ${destinationPath}`);
      return destinationPath;
    } catch {
      // Archivo no existe, continuar
    }

    await fs.copyFile(sourcePath, destinationPath);
    loggerGlobal.info(`Archivo copiado exitosamente: ${normalizePath(sourcePath)} -> ${destinationPath}`);
    return destinationPath;
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Archivo origen no encontrado: ${normalizePath(sourcePath)}`);
    }
    throw new Error(`Error al copiar archivo: ${error.message}`);
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

export const deletePhysicalFiles = async (files) => {
  const results = {
    success: [],
    failed: [],
    notFound: []
  };

  const deletePromises = files.map(async (file) => {
    const filePath = await fileParameterValueDAO.buildFilePathFromCode(file.code);
    try {
      await fs.access(filePath); // solo sigue si existe
      await fs.unlink(filePath);
      results.success.push({ code: file.code, path: filePath });
    } catch (error) {
      if (error.code === 'ENOENT') {
        results.notFound.push({ code: file.code, path: filePath });
      } else {
        results.failed.push({ code: file.code, error: error.message });
      }
    }
  });

  // Ejecuta todas las promesas en paralelo y se lanzan al mismo tiempo, ya que si usaramos un job tendriamos problemas de que debe esperar siempre una tras otra
  await Promise.all(deletePromises);

  return results;
};
