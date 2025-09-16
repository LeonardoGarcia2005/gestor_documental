import { loggerGlobal } from "../logging/loggerManager.js";
import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";

const getFileByMd5AndRouteRuleId = async (md5, routeRuleId) => {
  try {
    // Consulta parametrizada para evitar inyección SQL
    const queryFile = `
            SELECT url_calculated AS urlFile, code AS codeFile
            FROM file 
            WHERE route_rule_id = $1 AND file_hash_md5 = $2 AND status = TRUE
        `;

    const values = [routeRuleId, md5];

    // Ejecución de la consulta
    const resultFile = await dbConnectionProvider.firstOrDefault(
      queryFile,
      values
    );

    // Retornar resultado o null si no se encuentra
    return resultFile;
  } catch (err) {
    loggerGlobal.error(`Error al obtener las extensiones`, err);
    throw new Error("Error al obtener las extensiones, intenta nuevamente");
  }
};

const filesDAO = {
    getFileByMd5AndRouteRuleId
};

export { filesDAO };