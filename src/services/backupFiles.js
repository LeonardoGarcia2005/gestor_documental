import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { loggerGlobal } from '../logging/loggerManager.js';
import { filesDAO } from '../dataAccessObjects/filesDAO.js';
import { auditLogDAO } from '../dataAccessObjects/auditLogDAO.js';
import { fileParameterValueDAO } from '../dataAccessObjects/fileParameterValueDAO.js';
import { dbConnectionProvider } from '../config/db/dbConnectionManager.js';
import { configurationProvider } from '../config/configurationManager.js';
import os from 'os';
import { normalizePath } from '../lib/formatters.js';

export const backupFiles = async () => {
  const batchId = uuidv4();
  const today = new Date().toISOString().split('T')[0];

  loggerGlobal.info(`🔄 [BACKUP] Iniciando backup en ${os.platform()}`);

  // Verificar si ya se ejecutó hoy
  const existingLog = await auditLogDAO.getBackupLog(today);
  
  if (existingLog) {
    loggerGlobal.warn(
      `⚠️ [BACKUP] Ya se ejecutó el backup hoy (${today}). ` +
      `Resultados previos: ${existingLog.successful_files} exitosos, ${existingLog.failed_files} errores`
    );
    
    return {
      alreadyExecuted: true,
      execution_date: today,
      previousResults: {
        totalFiles: existingLog.total_files,
        filesBackedUp: existingLog.successful_files,
        errors: existingLog.failed_files
      }
    };
  }

  const filesExpired = await filesDAO.getFilesExpired();

  if (!filesExpired.length) {
    loggerGlobal.info('[BACKUP] No hay archivos expirados para respaldar.\n');

    const data = {
      execution_date: today,
      total_files: 0,
      successful_files: 0,
      failed_files: 0,
      files_processed: { batch_id: batchId, files: [] }
    };

    await auditLogDAO.logBackupExecution(data);
    return { totalFiles: 0, filesBackedUp: 0, errors: 0 };
  }

  loggerGlobal.info(`📋 [BACKUP] ${filesExpired.length} archivos expirados encontrados`);

  const results = {
    totalFiles: filesExpired.length,
    filesBackedUp: 0,
    errors: 0
  };

  const processedFiles = [];

  const batchResults = await Promise.allSettled(
    filesExpired.map(async (file) => {
      return await backupSingleFile(file);
    })
  );

  // Recopilar resultados
  batchResults.forEach(result => {
    if (result.status === 'fulfilled' && result.value) {
      if (result.value.status === 'success') {
        results.filesBackedUp++;
      } else if (result.value.status === 'failed') {
        results.errors++;
      }
      processedFiles.push(result.value);
    } else if (result.status === 'rejected') {
      results.errors++;
      loggerGlobal.error('❌ Promise rejected (error inesperado):', result.reason);
      processedFiles.push({
        file_id: null,
        code: 'unknown',
        status: 'failed',
        error: result.reason?.message || 'Error desconocido'
      });
    }
  });

  const data = {
    execution_date: today,
    total_files: results.totalFiles,
    successful_files: results.filesBackedUp,
    failed_files: results.errors,
    files_processed: {
      batch_id: batchId,
      files: processedFiles
    }
  };

  const auditResult = await auditLogDAO.logBackupExecution(data);

  if (auditResult.alreadyExists) {
    loggerGlobal.warn(
      `⚠️ [BACKUP] El backup de hoy ya fue registrado previamente. Resultados actuales no guardados.`
    );
  }

  loggerGlobal.info(
    `✅ [BACKUP] Finalizado: ${results.filesBackedUp} exitosos, ${results.errors} errores de ${results.totalFiles} archivos`
  );

  return results;
};

/**
 * Respalda un archivo individual con transacción atómica
 * SIEMPRE retorna un objeto (nunca rechaza la promesa)
 * Compatible con Windows y Linux
 */
const backupSingleFile = async (file) => {
  let originalPath = null;
  let backupPath = null;
  let backupCreated = false;

  try {
    // Construir rutas (path.join maneja separadores automáticamente)
    originalPath = await fileParameterValueDAO.buildFilePathFromCode(file.code);

    originalPath = normalizePath(originalPath);

    const backupBaseDir = file.security_level === 'private' || file.type === 'private'
      ? configurationProvider.backup.pathPrivate
      : configurationProvider.backup.pathPublic;

    if (!backupBaseDir) {
      throw new Error('PATH_BACKUP no configurado en la configuración');
    }

    // Construir ruta de backup manteniendo estructura
    const fileName = path.basename(originalPath);
    backupPath = path.normalize(path.join(backupBaseDir, fileName));

    // Verificar archivo original existe
    try {
      await fs.access(originalPath, fs.constants.R_OK);
    } catch (accessError) {
      throw new Error(`Archivo no accesible: ${accessError.code}`);
    }

    const originalStats = await fs.stat(originalPath);

    // Crear directorio de backup (recursive funciona en ambos OS)
    await fs.mkdir(path.dirname(backupPath), { recursive: true });

    // Copiar archivo al backup
    await fs.copyFile(originalPath, backupPath);
    backupCreated = true;

    // Verificar integridad de la copia
    const backupStats = await fs.stat(backupPath);
    if (originalStats.size !== backupStats.size) {
      throw new Error(`Integridad comprometida: original ${originalStats.size} bytes != backup ${backupStats.size} bytes`);
    }

    // Actualizar BD (SOLO esto en transacción)
    await dbConnectionProvider.tx(async (t) => {
      await filesDAO.changeIsBackupFile(file.code, true, t);
    });

    // DESPUÉS de actualizar BD, eliminar archivo original
    try {
      await fs.unlink(originalPath);
    } catch (unlinkError) {
      // Si falla el unlink, registrar pero NO fallar el backup
      loggerGlobal.warn(
        `⚠️ [${file.code}] Archivo respaldado pero no se pudo eliminar original: ${unlinkError.message}`
      );
    }

    loggerGlobal.info(`✅ [${file.code}] Respaldado exitosamente (${(backupStats.size / 1024).toFixed(2)} KB)`);

    return {
      file_id: file.id,
      code: file.code,
      status: 'success',
      original_path: originalPath,
      backup_path: backupPath,
      size_bytes: backupStats.size,
      security_level: file.security_level || file.type,
      expiration_date: file.document_expiration_date
    };

  } catch (error) {
    // Si algo falló, limpiar backup
    if (backupCreated && backupPath) {
      try {
        await fs.unlink(backupPath);
      } catch (cleanupError) {
        // Silencioso en cleanup
      }
    }

    const errorMsg = error.code === 'ENOENT'
      ? 'Archivo no encontrado en el sistema'
      : error.message;
    
    loggerGlobal.error(`❌ [${file.code}] ${errorMsg}`);

    return {
      file_id: file.id,
      code: file.code,
      status: 'failed',
      original_path: originalPath,
      backup_path: backupPath,
      error: errorMsg,
      error_code: error.code
    };
  }
};