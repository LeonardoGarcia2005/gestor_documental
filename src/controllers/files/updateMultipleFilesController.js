import { filesDAO } from "../../dataAccessObjects/filesDAO.js";
import fs from "fs/promises";
import path from "path";
import { fileParameterValueDAO } from "../../dataAccessObjects/fileParameterValueDAO.js";
import { loggerGlobal } from "../../logging/loggerManager.js";
import { dbConnectionProvider } from "../../config/db/dbConnectionManager.js";
import { sanitizeFileName } from "../../lib/formatters.js";
import { replaceFileFromBuffer, checkFileExists } from "../../services/fileSystem.js";
import calculateMD5 from "../../lib/calculateMD5.js";
import { buildFileUrl } from "../../lib/builder.js";

export const updateMultipleFiles = async (req, res) => {
  const fileToUpdate = req.fileToUpdate;
  const processedFiles = req.processedFiles;
  const { securityLevel } = req.body;

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
  const securityLevels = process.env.SECURITY_LEVELS?.split(',') || [];
  const publicLevel = securityLevels.find((level) =>
    level.toLowerCase().includes(process.env.SECURITY_PUBLIC_LEVEL?.toLowerCase() || 'public')
  );
  const isPublic = securityLevel === publicLevel;

  // Guardamos copias de seguridad de los archivos originales
  const backupFiles = [];
  const updatedFilePaths = [];
  const updatedFilesInfo = [];

  try {
    const validatedData = [];

    // FASE 1: Validación y preparación (sin modificar nada aún)
    for (let i = 0; i < fileToUpdate.length; i++) {
      const f = fileToUpdate[i];
      const processed = processedFiles[i];

      if (!f.file || !f.file.originalname) {
        throw new Error(`Falta información del archivo (${f.code})`);
      }

      if (!processed || !processed.extensionId) {
        throw new Error(`No se encontró la extensión procesada para ${f.file.originalname}`);
      }

      const fileName = sanitizeFileName(f.file.originalname, "50");
      const fileSize = f.file.size;
      const md5 = calculateMD5(f.file.buffer);
      const oldCode = f.code;

      const oldFile = await filesDAO.getFileByCode(oldCode);
      if (!oldFile) {
        throw new Error(`El archivo con código ${oldCode} no se encontró.`);
      }

      const fileExists = await filesDAO.getFileByMd5AndRouteRuleId(md5, oldFile.route_rule_id);
      if (fileExists) {
        throw new Error(`La imagen que intentas subir es idéntica a otra que ya existe en esta misma ubicación (${oldCode}).`);
      }

      const filePath = await fileParameterValueDAO.buildFilePathFromCode(oldCode);

      validatedData.push({
        fileName,
        oldCode,
        fileSize,
        md5,
        extensionId: processed.extensionId,
        filePath,
        buffer: f.file.buffer,
      });
    }

    // Actualización dentro de transacción
    await dbConnectionProvider.tx(async (t) => {
      for (const data of validatedData) {
        // Crear backup del archivo original
        const backupPath = `${data.filePath}.backup_${Date.now()}`;
        try {
          const originalExists = await checkFileExists(data.filePath);
          if (originalExists) {
            await fs.copyFile(data.filePath, backupPath);
            // Guardamos el nombre ANTIGUO del archivo
            backupFiles.push({ 
              original: data.filePath, 
              backup: backupPath,
              oldFileName: path.basename(data.filePath)
            });
          }
        } catch (backupError) {
          loggerGlobal.error(`Error creando backup de ${data.filePath}:`, backupError);
          throw new Error(`No se pudo crear backup del archivo ${data.oldCode}`);
        }

        // Actualizar base de datos
        const updatedFile = await filesDAO.updateFile(
          {
            fileName: data.fileName,
            oldCode: data.oldCode,
            fileSize: data.fileSize,
            md5: data.md5,
            extensionId: data.extensionId,
          },
          t
        );

        // Reemplazar archivo físico
        try {
          const result = await replaceFileFromBuffer(data.filePath, data.buffer, data.fileName);
          
          // ACTUALIZAR el backup con la NUEVA ruta después del rename
          const backupIndex = backupFiles.findIndex(b => b.original === data.filePath);
          if (backupIndex !== -1) {
            backupFiles[backupIndex].original = result.filePath;
            backupFiles[backupIndex].newFileName = data.fileName;
          }
          
          updatedFilePaths.push(result.filePath);

          // Construir información del archivo actualizado
          const fileInfo = {
            codeFile: data.oldCode,
            fileName: data.fileName,
          };

          // Solo incluir URL si es público
          if (isPublic) {
            try {
              fileInfo.fileUrl = buildFileUrl(result.filePath);
            } catch (urlError) {
              loggerGlobal.warn(`No se pudo construir URL para ${data.oldCode}:`, urlError);
              // Continuar sin la URL si falla
            }
          }

          updatedFilesInfo.push(fileInfo);

        } catch (fileError) {
          loggerGlobal.error(`Error reemplazando archivo ${data.filePath}:`, fileError);
          throw new Error(`No se pudo reemplazar el archivo físico ${data.oldCode}: ${fileError.message}`);
        }
      }
    });

    // Éxito - eliminar backups
    for (const { backup } of backupFiles) {
      try {
        await fs.unlink(backup);
      } catch (cleanupError) {
        loggerGlobal.warn(`No se pudo eliminar backup ${backup}:`, cleanupError);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Todos los archivos fueron actualizados exitosamente",
      updatedCount: validatedData.length,
      files: updatedFilesInfo, // 🆕 Array con código y URL (si es público)
    });

  } catch (error) {
    loggerGlobal.error("Error en updateMultipleFiles:", error);

    // ROLLBACK - Restaurar archivos desde backups
    if (backupFiles.length > 0) {
      loggerGlobal.info("Iniciando rollback de archivos...");
      for (const { original, backup, oldFileName } of backupFiles) {
        try {
          const backupExists = await checkFileExists(backup);
          if (backupExists) {
            // Calcular la ruta original (con el nombre ANTIGUO)
            const dir = path.dirname(original);
            const originalPath = oldFileName ? path.join(dir, oldFileName) : original;
            
            // Primero, eliminar el archivo nuevo si existe
            const newFileExists = await checkFileExists(original);
            if (newFileExists) {
              await fs.unlink(original);
              loggerGlobal.info(`Archivo nuevo eliminado: ${original}`);
            }
            
            // Restaurar el backup con su nombre original
            await fs.copyFile(backup, originalPath);
            await fs.unlink(backup);
            loggerGlobal.info(`Archivo restaurado: ${originalPath}`);
          }
        } catch (rollbackError) {
          loggerGlobal.error(`Error en rollback de ${original}:`, rollbackError);
        }
      }
    }

    return res.status(500).json({
      success: false,
      message: "Error actualizando archivos. Se revirtieron todos los cambios.",
      details: error.message,
    });
  }
};