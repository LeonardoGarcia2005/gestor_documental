import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";
import { loggerGlobal } from "../logging/loggerManager.js";

const existDocumentType = async (documentType) => {
  try {
    // Consulta parametrizada para evitar inyección SQL
    const queryDocumentType = `
        SELECT EXISTS (
          SELECT 1
          FROM document_type
          WHERE status = TRUE
          AND name = $1
        );
    `;

    const values = [documentType];

    // Ejecución de la consulta
    const resultDocumentType = await dbConnectionProvider.firstOrDefault(
      queryDocumentType,
      values
    );

    // Retornar true o false
    return resultDocumentType;
  } catch (err) {
    loggerGlobal.error(`Error al obtener el canal`, err);
    throw new Error("Error al obtener el canal");
  }
};

const documentTypeDAO = {
  existDocumentType: existDocumentType,
};

export { documentTypeDAO };