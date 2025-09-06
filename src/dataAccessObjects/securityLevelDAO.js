import { dbConnectionProvider } from "../db/dbConnectionManager.js";
import { loggerGlobal } from "../../globalServices/logging/loggerManager.js";

const getSecurityByLevel = async (level) => {
  try {
    // Consulta parametrizada para evitar inyección SQL
    const querySecurity = `
            SELECT id, status, type
                FROM security_level 
                WHERE status = $1
        `;

    const values = [level];

    // Ejecución de la consulta
    const resultSecurity = await dbConnectionProvider.firstOrDefault(
      querySecurity,
      values
    );

    // Retornar resultado o null si no se encuentra
    return resultSecurity;
  } catch (err) {
    loggerGlobal.error(`Error al obtener el nivel de seguridad`, err);
    throw new Error(
      "Error al obtener el nivel de seguridad, intenta nuevamente"
    );
  }
};

const gestSecurityAndFileByCodefile = async (codeFile) => {
  try {
    const querySecurity = `
      SELECT secu.id, secu.type, secu.status, f.url FROM security_level as secu
        INNER JOIN file AS f ON secu.id = f.security_level_id
        WHERE f.code = $1
        `;

    const values = [codeFile];

    // Ejecución de la consulta
    const resultSecurity = await dbConnectionProvider.firstOrDefault(
      querySecurity,
      values
    );
    // Retornar resultado o null si no se encuentra
    return resultSecurity;
  } catch (error) {
    loggerGlobal.error(
      `Error al obtener el nivel de seguridad por el codeFile ${codeFile}`,
      err
    );
    throw new Error("Error al obtener el nivel de seguridad por el codeFile");
  }
};

const securityLevelDAO = {
  getSecurityByLevel,
  gestSecurityAndFileByCodefile,
};

export { securityLevelDAO };
