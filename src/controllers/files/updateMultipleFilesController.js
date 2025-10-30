import { filesDAO } from "../../dataAccessObjects/filesDAO.js";
import fs from "fs/promises";
import path from "path";
import { fileParameterValueDAO } from "../../dataAccessObjects/fileParameterValueDAO.js";
import { loggerGlobal } from "../../logging/loggerManager.js";
import { dbConnectionProvider } from "../../config/db/dbConnectionManager.js";
import { sanitizeFileName } from "../../lib/formatters.js";
import {
  replaceFileFromBuffer,
  checkFileExists,
  saveFileFromBuffer,
} from "../../services/fileSystem.js";
import calculateMD5 from "../../lib/calculateMD5.js";
import { buildFileUrl } from "../../lib/builder.js";
import { configurationProvider } from "../../config/configurationManager.js";
import { generateCodeFile } from "../../lib/generators.js";
import { formatNameByCode } from "../../lib/formatters.js";

/**
 * Actualiza múltiples archivos con lógica de copy-on-write y deduplicación
 * 
 * Comportamientos:
 * 1. Si reference_count = 1 y is_shared = false → Actualización in-place (mismo código)
 * 2. Si reference_count > 1 o is_shared = true:
 *    a. Si nuevo MD5 ya existe → Reutilizar archivo (incrementar contador, retornar código existente)
 *    b. Si nuevo MD5 no existe → Crear nuevo archivo (nuevo código)
 */
export const updateMultipleFiles = async (req, res) => {
  const fileToUpdate = req.fileToUpdate;
  const processedFiles = req.processedFiles;
  const { securityLevel } = req.body;

  // ========== VALIDACIONES INICIALES ==========
  if (!fileToUpdate || fileToUpdate.length === 0) {
    return res.status(400).json({
      message: "No se recibieron archivos para actualizar",
    });
  }

  if (!processedFiles || processedFiles.length === 0) {
    return res.status(400).json({
      message: "No se encontraron archivos procesados",
    });
  }

  // Determinar si es nivel público
  const publicSecurityLevel =
    configurationProvider.uploads.securityPublicLevel?.toLowerCase() || "public";
  const isPublicFile = securityLevel?.toLowerCase() === publicSecurityLevel;

  // ========== ESTRUCTURAS PARA ROLLBACK ==========
  const backupFiles = [];

  // ========== CATEGORIZACIÓN DE RESULTADOS ==========
  const updatedInPlace = [];      // Actualizaciones normales (mismo código)
  const newFilesCreated = [];     // Nuevos archivos creados (nuevo código)
  const filesReused = [];         // Archivos reutilizados (código existente diferente)

  try {
    const validatedData = [];

    // ========== VALIDACIÓN Y PREPARACIÓN ==========
    loggerGlobal.info(`Iniciando actualización de ${fileToUpdate.length} archivos`);

    for (let i = 0; i < fileToUpdate.length; i++) {
      const f = fileToUpdate[i];
      const processed = processedFiles[i];
      const codeFile = f.code;

      // Validar estructura básica
      if (!f.file || !f.file.originalname) {
        throw new Error(`Falta información del archivo (${codeFile})`);
      }

      if (!processed || !processed.extensionId) {
        throw new Error(
          `No se encontró la extensión procesada para ${f.file.originalname}`
        );
      }

      // Obtener archivo original de la BD
      const originalFile = await filesDAO.getFileByCode(codeFile);
      if (!originalFile) {
        throw new Error(`El archivo con código ${codeFile} no se encontró.`);
      }

      // VALIDACIÓN TEMPRANA: Verificar si el archivo está en uso
      // Si no está compartido Y el reference_count es 0, significa que nunca fue activado
      const isSharedFile = originalFile.referenceCount > 1 && originalFile.isShared === true;
      
      if (!isSharedFile && originalFile.referenceCount === 0) {
        throw new Error(`El archivo con código ${codeFile} no se ha activado, entonces no se puede actualizar`);
      }

      // Calcular datos del nuevo archivo
      const fileName = sanitizeFileName(f.file.originalname, "50");
      const fileSize = f.file.size;
      const newMd5 = calculateMD5(f.file.buffer);

      validatedData.push({
        index: i,
        codeFile,
        fileName,
        fileSize,
        newMd5,
        extensionId: processed.extensionId,
        buffer: f.file.buffer,
        originalFile, // Guardamos toda la info del archivo original
      });
    }

    // ========== PROCESAMIENTO EN TRANSACCIÓN ==========
    await dbConnectionProvider.tx(async (t) => {

      for (const data of validatedData) {
        const { originalFile, newMd5, codeFile, fileName, fileSize, extensionId, buffer } = data;

        // ========== DECISIÓN: ¿ACTUALIZACIÓN IN-PLACE O COPY-ON-WRITE? ==========
        const isSharedFile = originalFile.referenceCount > 1 && originalFile.isShared === true;

        if (!isSharedFile) {
          // ==========================================
          // ACTUALIZACIÓN IN-PLACE (NORMAL)
          // ==========================================
          loggerGlobal.info(`[IN-PLACE] Actualizando archivo ${codeFile} directamente`);

          // Construir ruta del archivo
          const filePath = await fileParameterValueDAO.buildFilePathFromCode(codeFile);

          // Crear backup del archivo original
          await createBackup(filePath, backupFiles);

          // Actualizar en base de datos
          await filesDAO.updateFile(
            {
              fileName,
              oldCode: codeFile,
              fileSize,
              md5: newMd5,
              extensionId,
            },
            t
          );

          // Se ajusta el fileName para que tenga tanto el codigo como la extension
          const newFileName = formatNameByCode(fileName, codeFile);

          // Reemplazar archivo físico
          const result = await replaceFileFromBuffer(filePath, buffer, newFileName);

          // Actualizar backup con nueva ruta (por si cambió el nombre)
          updateBackupPath(backupFiles, filePath, result.filePath, newFileName);

          // Construir respuesta
          const fileInfo = {
            newCode: codeFile,
            fileName: newFileName,
            fileUrl: buildFileUrl(result.filePath),
          };

          updatedInPlace.push(fileInfo);

        } else {
          // =============================
          // COPY-ON-WRITE O REUTILIZACIÓN
          // =============================
          loggerGlobal.info(`[SHARED] Archivo compartido ${codeFile}, buscando deduplicación...`);

          // Buscar si ya existe un archivo con el nuevo MD5
          const existingFile = await filesDAO.getFileByMd5AndRouteRuleId(
            newMd5,
            originalFile.routeRuleId
          );

          if (existingFile) {
            // =============================
            // ARCHIVO REUTILIZADO (DEDUPLICACIÓN)
            // =============================
            loggerGlobal.info(`[REUSED] Archivo con MD5 ${newMd5} ya existe: ${existingFile.codeFile}`);

            // Obtener el ID del archivo existente para poder incrementar su contador
            const existingFileData = await filesDAO.getFileByCode(existingFile.codeFile);

            if (!existingFileData) {
              throw new Error(`No se pudo obtener datos del archivo existente: ${existingFile.codeFile}`);
            }

            // Incrementar contador del archivo existente
            await filesDAO.updateFileStatusAtomic(existingFileData.id, true, t);

            // Decrementar contador del archivo original
            await filesDAO.updateFileStatusAtomic(originalFile.id, false, t);

            // Construir ruta para respuesta
            const existingFilePath = await fileParameterValueDAO.buildFilePathFromCode(existingFile.codeFile);

            // Construir respuesta
            const fileInfo = {
              oldCode: codeFile,
              newCode: existingFile.codeFile,
              fileName: existingFile.fileName,
              fileUrl: buildFileUrl(existingFilePath),
            };

            filesReused.push(fileInfo);

          } else {
            // =============================
            // CREAR NUEVO ARCHIVO (COPY-ON-WRITE)
            // =============================
            loggerGlobal.info(`[NEW] Creando nuevo archivo para ${codeFile}`);

            // Generar nuevo código único
            const newCode = generateCodeFile();

            // Construir el nuevo nombre de archivo con el código
            const newFileName = formatNameByCode(fileName, newCode);

            loggerGlobal.info(`[NEW] Nombre del nuevo archivo: ${newFileName}`);

            // Crear nuevo registro en BD
            const newFileRecord = await filesDAO.insertFile(
              originalFile.companyId,
              originalFile.documentTypeId,
              originalFile.channelId,
              originalFile.securityLevelId,
              extensionId,
              newCode,
              true, // is_used
              originalFile.routeRuleId,
              newFileName,
              originalFile.documentEmissionDate,
              originalFile.documentExpirationDate,
              originalFile.hasVariants,
              fileSize,
              newMd5,
              1,
              t
            );

            // Copiar parámetros del archivo original al nuevo
            await filesDAO.copyFileParameters(originalFile.id, newFileRecord.id, t);

            // Construir ruta del archivo ORIGINAL
            const originalFilePath = await fileParameterValueDAO.buildFilePathFromCode(originalFile.code);

            // Dividir por el separador y reemplazar el último elemento (nombre del archivo)
            const pathParts = originalFilePath.split('/');
            pathParts[pathParts.length - 1] = newFileName;
            const newFilePath = pathParts.join('/');

            loggerGlobal.info(`[NEW] Ruta completa del nuevo archivo: ${newFilePath}`);

            // Guardar archivo físico
            await saveFileFromBuffer(newFilePath, buffer);

            // Decrementar contador del archivo original
            await filesDAO.updateFileStatusAtomic(originalFile.id, false, t);

            // Construir respuesta
            const fileInfo = {
              oldCode: codeFile,
              newCode: newCode,
              fileName: newFileName,
            };

            if (isPublicFile) {
              fileInfo.fileUrl = buildFileUrl(newFilePath);
            }

            newFilesCreated.push(fileInfo);
          }
        }
      }
    });

    // =============================
    // ÉXITO: LIMPIAR BACKUPS
    // =============================
    await cleanupBackups(backupFiles);

    loggerGlobal.info(`Actualización exitosa: ${updatedInPlace.length} in-place, ${newFilesCreated.length} nuevos, ${filesReused.length} reutilizados`);

    return res.status(200).json({
      success: true,
      message: "Todos los archivos fueron procesados exitosamente",
      summary: {
        total: validatedData.length,
        updatedInPlace: updatedInPlace.length,
        newFilesCreated: newFilesCreated.length,
        filesReused: filesReused.length,
      },
      files: {
        updatedInPlace,    // Archivos actualizados normalmente (mismo código)
        newFilesCreated,   // Archivos nuevos creados (nuevo código)
        filesReused,       // Archivos que ya existían (código existente)
      },
    });

  } catch (error) {
    loggerGlobal.error("Error en updateMultipleFiles:", error);

    // =============================
    // ROLLBACK: RESTAURAR ARCHIVOS
    // =============================
    await rollbackFiles(backupFiles);

    return res.status(500).json({
      success: false,
      message: "Error actualizando archivos. Se revirtieron todos los cambios.",
      details: error.message,
    });
  }
};

// ========== FUNCIONES AUXILIARES ==========

/**
 * Crea un backup del archivo antes de modificarlo
 */
const createBackup = async (filePath, backupFiles) => {
  const backupPath = `${filePath}.backup_${Date.now()}`;

  try {
    const originalExists = await checkFileExists(filePath);
    if (originalExists) {
      await fs.copyFile(filePath, backupPath);
      backupFiles.push({
        original: filePath,
        backup: backupPath,
        oldFileName: path.basename(filePath),
      });
      loggerGlobal.info(`Backup creado: ${backupPath}`);
    }
  } catch (backupError) {
    loggerGlobal.error(`Error creando backup de ${filePath}:`, backupError);
    throw new Error(`No se pudo crear backup del archivo: ${filePath}`);
  }
}

/**
 * Actualiza la ruta del backup si el archivo fue renombrado
 */
const updateBackupPath = (backupFiles, oldPath, newPath, newFileName) => {
  const backupIndex = backupFiles.findIndex((b) => b.original === oldPath);
  if (backupIndex !== -1) {
    backupFiles[backupIndex].original = newPath;
    backupFiles[backupIndex].newFileName = newFileName;
  }
}

/**
 * Elimina los backups después de una operación exitosa
 */
const cleanupBackups = async (backupFiles) => {
  for (const { backup } of backupFiles) {
    try {
      await fs.unlink(backup);
      loggerGlobal.info(`Backup eliminado: ${backup}`);
    } catch (cleanupError) {
      loggerGlobal.warn(`No se pudo eliminar backup ${backup}:`, cleanupError);
    }
  }
}

/**
 * Restaura los archivos desde los backups en caso de error
 */
const rollbackFiles = async (backupFiles) => {
  if (backupFiles.length === 0) return;

  loggerGlobal.info("Iniciando rollback de archivos...");

  for (const { original, backup, oldFileName } of backupFiles) {
    try {
      const backupExists = await checkFileExists(backup);
      if (!backupExists) continue;

      // Calcular la ruta original (con el nombre ANTIGUO)
      const dir = path.dirname(original);
      const originalPath = oldFileName ? path.join(dir, oldFileName) : original;

      // Eliminar el archivo nuevo si existe
      const newFileExists = await checkFileExists(original);
      if (newFileExists) {
        await fs.unlink(original);
        loggerGlobal.info(`Archivo nuevo eliminado: ${original}`);
      }

      // Restaurar el backup
      await fs.copyFile(backup, originalPath);
      await fs.unlink(backup);
      loggerGlobal.info(`Archivo restaurado: ${originalPath}`);

    } catch (rollbackError) {
      loggerGlobal.error(`Error en rollback de ${original}:`, rollbackError);
    }
  }
}
