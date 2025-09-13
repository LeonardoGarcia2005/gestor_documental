import { loggerGlobal } from "../logging/loggerManager.js";
import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";

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

const getAllExtensions = async () => {
  try {
    // Consulta parametrizada para evitar inyección SQL
    const queryExtension = `
            SELECT id, name 
            FROM extension 
            WHERE status = TRUE
        `;

    // Ejecución de la consulta
    const resultExtension = await dbConnectionProvider.getAll(
      queryExtension
    );

    // Retornar resultado o null si no se encuentra
    return resultExtension;
  } catch (err) {
    loggerGlobal.error(`Error al obtener las extensiones`, err);
    throw new Error("Error al obtener las extensiones, intenta nuevamente");
  }
}

const extensionDAO = {
  getExtensionByName,
  getAllExtensions
};

export { extensionDAO };
