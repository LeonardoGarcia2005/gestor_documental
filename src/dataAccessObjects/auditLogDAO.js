import { loggerGlobal } from "../logging/loggerManager.js";
import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";

const logBackupExecution = async (data) => {
  try {
    // Convertir files_processed a string JSON si no lo está
    const dataToInsert = {
      execution_date: data.execution_date,
      total_files: data.total_files,
      successful_files: data.successful_files,
      failed_files: data.failed_files,
      files_processed: typeof data.files_processed === 'string' 
        ? data.files_processed 
        : JSON.stringify(data.files_processed)
    };

    // Usar insertOne correctamente: (nombreTabla, objeto)
    const result = await dbConnectionProvider.insertOne(
      'backup_execution_log',
      dataToInsert
    );

    return result;
    
  } catch (err) {
    // ✅ Detectar error de clave duplicada (código 23505 de PostgreSQL)
    if (err.code === '23505' && err.constraint === 'unique_execution_date') {
      const message = `⚠️ Ya existe un registro de backup para la fecha ${data.execution_date}`;
      loggerGlobal.warn(message);
      
      // Retornar un objeto indicando que ya existe (no lanzar error)
      return {
        alreadyExists: true,
        execution_date: data.execution_date,
        message: 'El backup de hoy ya fue registrado previamente'
      };
    }
    
    // ✅ Para cualquier otro error, sí lanzar
    loggerGlobal.error(`Error al registrar la ejecución de backup:`, err.message);
    throw new Error("Error al registrar la ejecución de backup, intenta nuevamente");
  }
};

const getBackupLog = async (date) => {
  try {
    const query = `
      SELECT * FROM backup_execution_log
      WHERE execution_date = $1;
    `;
    
    const result = await dbConnectionProvider.db.oneOrNone(query, [date]);
    return result;
  } catch (err) {
    loggerGlobal.error(`Error al consultar log de backup:`, err.message);
    return null;
  }
};

const auditLogDAO = {
  logBackupExecution,
  getBackupLog
};

export { auditLogDAO };