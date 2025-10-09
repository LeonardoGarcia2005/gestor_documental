import { filesDAO } from "../../dataAccessObjects/filesDAO.js";
import fs from "fs/promises";
import { fileParameterValueDAO } from "../../dataAccessObjects/fileParameterValueDAO.js";
import { loggerGlobal } from "../../logging/loggerManager.js";
import { dbConnectionProvider } from "../../config/db/dbConnectionManager.js";
import { sanitizeFileName } from "../../lib/formatters.js";
import { replaceFileFromBuffer, checkFileExists } from "../../services/fileSystem.js";
import calculateMD5 from "../../lib/calculateMD5.js";

export const updateMultipleFiles = async (req, res) => {
  const fileToUpdate = req.fileToUpdate;
  const processedFiles = req.processedFiles;

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

  // Guardamos copias de seguridad de los archivos originales
  const backupFiles = [];
  const updatedFilePaths = [];

  try {
    const validatedData = [];

    // Validación y preparación (sin modificar nada aún)
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
            backupFiles.push({ original: data.filePath, backup: backupPath });
          }
        } catch (backupError) {
          loggerGlobal.error(`Error creando backup de ${data.filePath}:`, backupError);
          throw new Error(`No se pudo crear backup del archivo ${data.oldCode}`);
        }

        // Actualizar base de datos
        await filesDAO.updateFile(
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
          await replaceFileFromBuffer(data.filePath, data.buffer, data.fileName);
          updatedFilePaths.push(data.filePath);
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
    });

  } catch (error) {
    loggerGlobal.error("Error en updateMultipleFiles:", error);

    // Restaurar archivos desde backups
    if (backupFiles.length > 0) {
      loggerGlobal.info("Iniciando rollback de archivos...");
      for (const { original, backup } of backupFiles) {
        try {
          const backupExists = await checkFileExists(backup);
          if (backupExists) {
            await fs.copyFile(backup, original);
            await fs.unlink(backup);
            loggerGlobal.info(`Archivo restaurado: ${original}`);
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
