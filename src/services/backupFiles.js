import { filesDAO } from "../dataAccessObjects/filesDAO.js";
import { loggerGlobal } from "../logging/loggerManager.js";
import { fileParameterValueDAO } from "../dataAccessObjects/fileParameterValueDAO.js"

export const backupFiles = async () => {
  const filesExpired = await filesDAO.getFilesExpired();

  if (!filesExpired.length) {
    loggerGlobal.info('[CRON] No hay archivos para procesar.\n');
    return { totalFiles: 0, filesBackedUp: 0, errors: 0 };
  }
  
  const results = {
    totalFiles: filesExpired.length,
    filesBackedUp: 0,
    errors: 0,
    errorDetails: []
  };

  const BATCH_SIZE = 50;
  
  for (let i = 0; i < filesExpired.length; i += BATCH_SIZE) {
    const batch = filesExpired.slice(i, i + BATCH_SIZE);
    
    await Promise.allSettled(
      batch.map(async (file) => {
        let originalPath = null;
        let backupPath = null;
        
        try {
          // Reconstruir ruta original del archivo
          originalPath = await fileParameterValueDAO.buildFilePathFromCode(file.code);
          
          // Crear directorios necesarios
          await fs.mkdir(path.dirname(originalPath), { recursive: true });
          
          // Verificar que archivo original existe
          await fs.access(originalPath, fs.constants.R_OK);
          const originalStats = await fs.stat(originalPath);
          
          // Copiar archivo al backup
          await fs.copyFile(originalPath, backupPath);
          
          // Verificar integridad
          const backupStats = await fs.stat(backupPath);
          
          if (originalStats.size !== backupStats.size) {
            throw new Error('Integridad comprometida: tamaños no coinciden');
          }
          
          // Calcular hash para verificación adicional
          const fileHash = await calculateFileHash(backupPath);
          
          // AHORA SÍ, eliminar el archivo original del disco
          await fs.unlink(originalPath);
          
          // Marcar como eliminado en metadata
          await filesDAO.updateFileBackupMetadata(file.id, {
            original_deleted: true
          });
          
          // Actualizar estado del archivo (MANTENER route_rule_id intacto)
          await filesDAO.updateFileStatus(file.id, 'backed_up');
          
          results.filesBackedUp++;
          
          loggerGlobal.info(
            `[${file.id}] Backup exitoso: ${path.basename(originalPath)} -> ${backupPath}`
          );
          
        } catch (error) {
          results.errors++;
          results.errorDetails.push({
            fileId: file.id,
            originalPath,
            backupPath,
            error: error.message,
            stack: error.stack
          });
          
          // Si falló, limpiar backup parcial
          if (backupPath) {
            try {
              await fs.unlink(backupPath);
              loggerGlobal.debug(`🧹 Limpiando backup fallido: ${backupPath}`);
            } catch (cleanupError) {
              loggerGlobal.error(`⚠️ No se pudo limpiar backup fallido: ${cleanupError.message}`);
            }
          }
          
          loggerGlobal.error(`❌ [${file.id}] Error en backup:`, error);
        }
      })
    );
    
    loggerGlobal.info(
      `📊 Progreso: ${Math.min(i + BATCH_SIZE, filesExpired.length)}/${filesExpired.length}`
    );
  }
  
  loggerGlobal.info(
    `✅ [BACKUP] Finalizado: ${results.filesBackedUp} exitosos, ${results.errors} errores`
  );
  
  // Generar reporte si hay errores
  if (results.errors > 0) {
    await generateErrorReport(results.errorDetails);
  }
  
  return results;
};