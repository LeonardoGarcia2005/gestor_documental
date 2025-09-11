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
const securityLevelDAO = {
  getSecurityByLevel,
};

export { securityLevelDAO };
