import { loggerGlobal } from "../../globalServices/logging/loggerManager.js";
import { dbConnectionProvider } from "../db/dbConnectionManager.js";

const getExtensionByName = async (name) => {
  try {
    // Consulta parametrizada para evitar inyección SQL
    const queryExtension = `
            SELECT * 
            FROM extension 
            WHERE status = TRUE AND name = $1
        `;

    const values = [name];

    // Ejecución de la consulta
    const resultExtension = await dbConnectionProvider.firstOrDefault(
      queryExtension,
      values
    );

    // Retornar resultado o null si no se encuentra
    return resultExtension;
  } catch (err) {
    loggerGlobal.error(`Error al obtener las extensiones`, err);
    throw new Error("Error al obtener las extensiones, intenta nuevamente");
  }
};

const extensionDAO = {
  getExtensionByName,
};

export { extensionDAO };
