import { loggerGlobal } from "../logging/loggerManager.js";
import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";

const getSecurityByType = async (type) => {
  try {
    // Consulta parametrizada para evitar inyección SQL
    const querySecurity = `
            SELECT id, type
                FROM security_level 
                WHERE type = $1
        `;

    const values = [type];

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
  getSecurityByType,
};

export { securityLevelDAO };
